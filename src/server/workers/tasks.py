import asyncio
import logging
import uuid
import json
import re
import datetime
import os
import httpx
from dateutil import rrule
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Dict, Any, Optional, List
from main.analytics import capture_event

from workers.config import SUPERMEMORY_MCP_BASE_URL, SUPERMEMORY_MCP_ENDPOINT_SUFFIX, SUPPORTED_POLLING_SERVICES
from main.agents.utils import clean_llm_output
from json_extractor import JsonExtractor
from workers.utils.api_client import notify_user 
from workers.celery_app import celery_app
from workers.planner.llm import get_planner_agent, get_question_generator_agent
from workers.planner.db import PlannerMongoManager, get_all_mcp_descriptions
from workers.supermemory_agent_utils import get_supermemory_qwen_agent, get_db_manager as get_memory_db_manager
from workers.executor.tasks import execute_task_plan

# Imports for extractor logic
from workers.extractor.llm import get_extractor_agent
from workers.extractor.db import ExtractorMongoManager

# Imports for poller logic
from workers.poller.gmail.service import GmailPollingService
from workers.poller.gcalendar.service import GCalendarPollingService
from workers.poller.gmail.db import PollerMongoManager as GmailPollerDB
from workers.poller.gcalendar.db import PollerMongoManager as GCalPollerDB

# Imports for LinkedIn scraping
from linkedin_scraper import Person, actions
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_date_from_text(text: str) -> str:
    """Extracts YYYY-MM-DD from text, defaults to today."""
    match = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', text)
    if match:
        return match.group(1)
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
# Helper to run async code in Celery's sync context
def run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

# --- Memory Processing Task (Modified for Supermemory) ---
@celery_app.task(name="process_memory_item")
def process_memory_item(user_id: str, fact_text: str, source_event_id: Optional[str] = None):
    """
    Celery task to process a single memory item by calling the Supermemory MCP
    via a dedicated Qwen agent.
    """
    log_prefix = f"Event {source_event_id}: " if source_event_id else ""
    logger.info(f"{log_prefix}Celery worker received Supermemory task for user {user_id}: '{fact_text[:80]}...'")

    async def async_process_memory():
        db_manager = get_memory_db_manager() # This is a PlannerMongoManager instance
        try:
            user_profile = await db_manager.user_profiles_collection.find_one({"user_id": user_id})
            if not user_profile:
                logger.error(f"User profile not found for {user_id}. Cannot process memory item.")
                return {"status": "failure", "reason": "User profile not found"}

            supermemory_user_id = user_profile.get("userData", {}).get("supermemory_user_id")
            if not supermemory_user_id:
                logger.warning(f"User {user_id} has no Supermemory User ID. Skipping memory item: '{fact_text[:50]}...'")
                return {"status": "skipped", "reason": "Supermemory MCP URL not configured"}

            supermemory_mcp_url = f"{SUPERMEMORY_MCP_BASE_URL.rstrip('/')}/{supermemory_user_id}{SUPERMEMORY_MCP_ENDPOINT_SUFFIX}"

            agent = get_supermemory_qwen_agent(supermemory_mcp_url)
            messages = [{'role': 'user', 'content': f"Remember this fact: {fact_text}"}]

            all_responses = list(agent.run(messages=messages))
            final_history = all_responses[-1] if all_responses else None
            
            if not final_history:
                logger.error(f"Supermemory agent produced no output for user {user_id}.")
                return {"status": "failure", "reason": "Agent produced no output"}

            function_call_succeeded = False
            tool_response_content = "No tool response received."

            for message in reversed(final_history):
                if message.get("role") == "function" and message.get("name") == "supermemory-addToSupermemory":
                    tool_response_content = message.get("content", "")
                    if isinstance(tool_response_content, str) and "success" in tool_response_content.lower():
                        function_call_succeeded = True
                    break

            if function_call_succeeded:
                logger.info(f"Successfully executed Supermemory store for user {user_id}. MCP Response: '{tool_response_content}'. Fact: '{fact_text[:50]}...'")
                return {"status": "success", "fact": fact_text, "mcp_response": tool_response_content}
            else:
                logger.error(f"Supermemory agent tool call failed for user {user_id}. Response: {tool_response_content}")
                return {"status": "failure", "reason": "Supermemory tool call did not succeed", "mcp_response": tool_response_content}
        finally:
            if 'db_manager' in locals() and db_manager:
                await db_manager.close()

    return run_async(async_process_memory())

# --- Extractor Task ---
@celery_app.task(name="extract_from_context")
def extract_from_context(user_id: str, service_name: str, event_id: str, event_data: Dict[str, Any], current_time_iso: Optional[str] = None):
    """
    Celery task to replace the Extractor worker. It takes context data,
    runs it through an LLM to extract memories and action items,
    and then dispatches further Celery tasks.
    """
    logger.info(f"Extractor task running for event_id: {event_id} (service: {service_name}) for user {user_id}")
    
    async def async_extract():
        db_manager = ExtractorMongoManager()
        try:
            if await db_manager.is_event_processed(user_id, event_id):
                logger.info(f"Skipping event_id: {event_id} - already processed.")
                return

            # Fetch user context to provide to the extractor agent
            user_profile = await db_manager.get_user_profile(user_id)
            personal_info = user_profile.get("userData", {}).get("personalInfo", {}) if user_profile else {}
            user_name = personal_info.get("name", "User")
            user_location_raw = personal_info.get("location", "Not specified")
            user_timezone = personal_info.get("timezone", "UTC")
            if isinstance(user_location_raw, dict) and 'latitude' in user_location_raw:
                user_location = f"latitude: {user_location_raw.get('latitude')}, longitude: {user_location_raw.get('longitude')}"
            else:
                user_location = user_location_raw

            current_time = datetime.datetime.fromisoformat(current_time_iso) if current_time_iso else datetime.datetime.now(datetime.timezone.utc)
            time_context_str = f"The current date and time is {current_time.strftime('%A, %Y-%m-%d %H:%M:%S %Z')}."

            llm_input_content = ""
            if service_name == "journal_block":
                page_date = event_data.get('page_date')
                if page_date:
                    llm_input_content = f"Source: Journal Entry on {page_date}\n\nContent:\n{event_data.get('content', '')}"
                else:
                    llm_input_content = f"Source: Journal Entry\n\nContent:\n{event_data.get('content', '')}"
            elif service_name == "gmail":
                llm_input_content = f"Source: Email\nSubject: {event_data.get('subject', '')}\n\nBody:\n{event_data.get('body', '')}"
            elif service_name == "gcalendar":
                llm_input_content = f"Source: Calendar Event\nSummary: {event_data.get('summary', '')}\n\nDescription:\n{event_data.get('description', '')}"

            # Add time context to the input for the LLM
            full_llm_input = f"{time_context_str}\n\nPlease analyze the following content:\n\n{llm_input_content}"

            if not llm_input_content or not llm_input_content.strip():
                logger.warning(f"Skipping event_id: {event_id} due to empty content.")
                return

            agent = get_extractor_agent(user_name, user_location, user_timezone)
            messages = [{'role': 'user', 'content': full_llm_input}]
            
            final_content_str = ""
            for chunk in agent.run(messages=messages):
                if isinstance(chunk, list) and chunk:
                    last_message = chunk[-1]
                    if last_message.get("role") == "assistant" and isinstance(last_message.get("content"), str):
                        final_content_str = last_message["content"]

            if not final_content_str.strip():
                logger.error(f"Extractor LLM returned no response for event_id: {event_id}.")
                return

            cleaned_content = clean_llm_output(final_content_str)
            extracted_data = JsonExtractor.extract_valid_json(cleaned_content)
            if not extracted_data:
                logger.error(f"Could not extract valid JSON from LLM response for event_id: {event_id}. Response: '{cleaned_content}'")
                await db_manager.log_extraction_result(event_id, user_id, 0, 0)
                return

            if isinstance(extracted_data, list):
                extracted_data = extracted_data[0] if extracted_data and isinstance(extracted_data[0], dict) else {}

            if not isinstance(extracted_data, dict):
                logger.error(f"Extracted JSON is not a dictionary for event_id: {event_id}. Extracted: '{extracted_data}'")
                await db_manager.log_extraction_result(event_id, user_id, 0, 0)
                return

            memory_items = extracted_data.get("memory_items", [])
            action_items = extracted_data.get("action_items", [])
            topics = extracted_data.get("topics", [])

            # --- SIMPLIFIED LOGIC ---
            # Always process extracted action items directly, regardless of source.
            if action_items:
                # The source_event_id is the original email/calendar/journal ID.
                # The original_context is the data from that event.
                process_action_item.delay(user_id, action_items, topics, event_id, event_data)
                logger.info(f"Dispatched {len(action_items)} action items from event {event_id} (service: {service_name}) to planner for user {user_id}")

            for fact in memory_items:
                if isinstance(fact, str) and fact.strip():
                    process_memory_item.delay(user_id, fact, event_id)

            await db_manager.log_extraction_result(event_id, user_id, len(memory_items), len(action_items))
        
        except Exception as e:
            logger.error(f"Error in extractor task for event_id: {event_id}: {e}", exc_info=True)
        finally:
            await db_manager.close()

    run_async(async_extract())

@celery_app.task(name="process_action_item")
def process_action_item(user_id: str, action_items: list, topics: list, source_event_id: str, original_context: dict):
    """Orchestrates the pre-planning phase for a new proactive task."""
    run_async(async_process_action_item(user_id, action_items, topics, source_event_id, original_context))

async def get_clarifying_questions(user_id: str, task_description: str, topics: list, original_context: dict, db_manager: PlannerMongoManager) -> List[str]:
    """
    Uses a unified agent to search memory and generate clarifying questions if needed.
    Returns a list of questions, which is empty if no clarification is required.
    """
    user_profile = await db_manager.user_profiles_collection.find_one({"user_id": user_id})
    supermemory_user_id = user_profile.get("userData", {}).get("supermemory_user_id") if user_profile else None

    if not supermemory_user_id:
        logger.warning(f"User {user_id} has no Supermemory ID. Cannot verify context.")
        return [f"Can you tell me more about '{topic}'?" for topic in topics]

    supermemory_mcp_url = f"{SUPERMEMORY_MCP_BASE_URL.rstrip('/')}/{supermemory_user_id}{SUPERMEMORY_MCP_ENDPOINT_SUFFIX}"
    available_tools = get_all_mcp_descriptions()

    agent = get_question_generator_agent(
        supermemory_mcp_url=supermemory_mcp_url,
        original_context=original_context,
        topics=topics,
        available_tools=available_tools
    )

    user_prompt = f"Based on the task '{task_description}' and the provided context, please determine if any clarifying questions are necessary."
    messages = [{'role': 'user', 'content': user_prompt}]

    final_response_str = ""
    for chunk in agent.run(messages=messages):
        if isinstance(chunk, list) and chunk and chunk[-1].get("role") == "assistant":
            final_response_str = chunk[-1].get("content", "")
    
    response_data = JsonExtractor.extract_valid_json(clean_llm_output(final_response_str))
    if response_data and isinstance(response_data.get("clarifying_questions"), list):
        return response_data["clarifying_questions"]
    else:
        logger.error(f"Question generator agent returned invalid data: {response_data}. Cannot ask for clarification.")
        return [] # Default to no questions on failure

async def async_process_action_item(user_id: str, action_items: list, topics: list, source_event_id: str, original_context: dict):
    """Async logic for the proactive task orchestrator."""
    db_manager = PlannerMongoManager()
    task_id = None
    try:
        task_description = " ".join(map(str, action_items))
        task_id = await db_manager.create_initial_task(user_id, task_description, action_items, topics, original_context, source_event_id)

        questions_list = await get_clarifying_questions(user_id, task_description, topics, original_context, db_manager)

        if questions_list:
            logger.info(f"Task {task_id}: Needs clarification. Questions: {questions_list}")
            questions_for_db = [
                {"question_id": str(uuid.uuid4()), "text": q.strip(), "answer": None} 
                for q in questions_list
            ]
            
            await db_manager.update_task_with_questions(task_id, "clarification_pending", questions_for_db)
            await notify_user(user_id, f"I have a few questions to help me plan: '{task_description[:50]}...'", task_id)
            capture_event(user_id, "clarification_needed", {
                "task_id": task_id,
                "question_count": len(questions_list)
            })
            logger.info(f"Task {task_id} moved to 'clarification_pending'.")
        else:
            logger.info(f"Task {task_id}: No clarification needed. Triggering plan generation.")
            await db_manager.update_task_status(task_id, "planning") # Set status to planning
            generate_plan_from_context.delay(task_id)

    except Exception as e:
        logger.error(f"Error in process_action_item for task {task_id or 'unknown'}: {e}", exc_info=True)
        if task_id:
            await db_manager.update_task_status(task_id, "error", {"error": str(e)})
    finally:
        await db_manager.close()

@celery_app.task(name="generate_plan_from_context")
def generate_plan_from_context(task_id: str):
    """Generates a plan for a task once all context is available."""
    run_async(async_generate_plan(task_id))

async def async_generate_plan(task_id: str):
    """Async logic for plan generation."""
    db_manager = PlannerMongoManager()
    try:
        task = await db_manager.get_task(task_id)
        if not task:
            logger.error(f"Cannot generate plan: Task {task_id} not found.")
            return

        user_id = task["user_id"]
        user_profile = await db_manager.user_profiles_collection.find_one(
            {"user_id": user_id},
            {"userData.personalInfo": 1} # Projection to get only necessary data
        )
        personal_info = user_profile.get("userData", {}).get("personalInfo", {})
        user_name = personal_info.get("name", "User")
        user_location_raw = personal_info.get("location", "Not specified")
        if isinstance(user_location_raw, dict):
            user_location = f"latitude: {user_location_raw.get('latitude')}, longitude: {user_location_raw.get('longitude')}"
        else:
            user_location = user_location_raw
        
        user_timezone_str = personal_info.get("timezone", "UTC")
        try:
            user_timezone = ZoneInfo(user_timezone_str)
        except ZoneInfoNotFoundError:
            logger.warning(f"Invalid timezone '{user_timezone_str}' for user {user_id}. Defaulting to UTC.")
            user_timezone = ZoneInfo("UTC")
        
        current_user_time = datetime.datetime.now(user_timezone).strftime('%Y-%m-%d %H:%M:%S %Z')

        retrieved_context = task.get("found_context", {})
        # ** NEW ** Add answered questions to the context
        answered_questions = []
        if task.get("clarifying_questions"):
            for q in task["clarifying_questions"]:
                if q.get("answer"):
                    answered_questions.append(f"User Clarification: Q: {q['text']} A: {q['answer']}")
        
        if answered_questions:
            retrieved_context["user_clarifications"] = "\n".join(answered_questions)
        
        available_tools = get_all_mcp_descriptions()

        planner_agent = get_planner_agent(available_tools, current_user_time, user_name, user_location, retrieved_context)
        
        action_items = task.get("action_items", [])
        user_prompt_content = "Please create a plan for the following action items:\n- " + "\n- ".join(action_items)
        messages = [{'role': 'user', 'content': user_prompt_content}]

        final_response_str = ""
        for chunk in planner_agent.run(messages=messages):
            if isinstance(chunk, list) and chunk and chunk[-1].get("role") == "assistant":
                final_response_str = chunk[-1].get("content", "")

        if not final_response_str:
            raise Exception("Planner agent returned no response.")

        plan_data = JsonExtractor.extract_valid_json(clean_llm_output(final_response_str))
        if not plan_data or "plan" not in plan_data:
            raise Exception(f"Planner agent returned invalid JSON: {final_response_str}")

        await db_manager.update_task_with_plan(task_id, plan_data)
        capture_event(user_id, "proactive_task_generated", {
            "task_id": task_id,
            "source": task.get("original_context", {}).get("source", "unknown"),
            "plan_steps": len(plan_data.get("plan", []))
        })

        # Notify user that a plan is ready for their approval
        await notify_user(
            user_id, f"I've created a new plan for you: '{plan_data.get('description', '...')[:50]}...'", task_id,
            notification_type="taskNeedsApproval"
        )

    except Exception as e:
        logger.error(f"Error generating plan for task {task_id}: {e}", exc_info=True)
        await db_manager.update_task_status(task_id, "error", {"error": str(e)})
    finally:
        await db_manager.close()

# --- LinkedIn Scraping Task ---
@celery_app.task(name="process_linkedin_profile")
def process_linkedin_profile(user_id: str, linkedin_url: str):
    """
    Scrapes a LinkedIn profile, formats the data, and sends it to Supermemory.
    This is a fail-safe task that should not raise exceptions that would cause a retry loop.
    """
    logger.info(f"Starting LinkedIn scraping for user {user_id} at URL: {linkedin_url}")
    
    linkedin_cookie = os.getenv("LINKEDIN_COOKIE")

    if not linkedin_cookie:
        logger.error("LINKEDIN_COOKIE environment variable is not set. Cannot scrape LinkedIn.")
        return {"status": "failure", "reason": "LinkedIn cookie not configured."}

    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--incognito")
    
    driver = None
    try:
        # Let Selenium/Chromedriver manage the user data directory automatically
        # by NOT specifying --user-data-dir.
        driver = webdriver.Chrome(options=chrome_options)
        
        logger.info(f"Logging into LinkedIn using session cookie...")
        actions.login(driver, cookie=linkedin_cookie)
        logger.info("LinkedIn login successful via cookie.")

        person = Person(linkedin_url, driver=driver, scrape=True, close_on_complete=False)
        
        if not person or not person.name:
             logger.error(f"Failed to scrape data for LinkedIn URL: {linkedin_url}")
             return {"status": "failure", "reason": "Scraping returned no data."}

        logger.info(f"Successfully scraped profile for: {person.name}")
        
        facts_to_remember = []
        if person.name and person.name.strip():
            facts_to_remember.append(f"The user's full name is {person.name}.")
        if person.about and person.about.strip():
            facts_to_remember.append(f"The user's LinkedIn 'About' section says: \"{person.about.strip()}\"")
        if person.job_title and person.company and person.job_title.strip() and person.company.strip():
             facts_to_remember.append(f"The user's current role is {person.job_title} at {person.company}.")

        for exp in person.experiences:
            pos_title = getattr(exp, 'position_title', 'a role')
            inst_name = getattr(exp, 'institution_name', 'a company')
            from_date = getattr(exp, 'from_date', 'an unknown start date')
            to_date = getattr(exp, 'to_date', 'an unknown end date')
            desc = getattr(exp, 'description', '')
            
            exp_str = f"The user has experience as a {pos_title} at {inst_name} from {from_date} to {to_date}."
            if desc and str(desc).strip():
                clean_desc = ' '.join(str(desc).split())
                exp_str += f" Description: {clean_desc[:250]}..."
            facts_to_remember.append(exp_str)

        for edu in person.educations:
            inst_name = getattr(edu, 'institution_name', 'an institution')
            degree = getattr(edu, 'degree', 'a degree')
            from_date = getattr(edu, 'from_date', 'an unknown start date')
            to_date = getattr(edu, 'to_date', 'an unknown end date')
            edu_str = f"The user studied at {inst_name}, pursuing {degree} from {from_date} to {to_date}."
            facts_to_remember.append(edu_str)
        
        logger.info(f"Formatted {len(facts_to_remember)} facts from LinkedIn profile.")

        for fact in facts_to_remember:
            process_memory_item.delay(user_id, fact)
        
        logger.info(f"Dispatched {len(facts_to_remember)} facts to Supermemory for user {user_id}.")
        return {"status": "success", "facts_generated": len(facts_to_remember)}

    except Exception as e:
        logger.error(f"An error occurred during LinkedIn scraping for user {user_id}: {e}", exc_info=True)
        return {"status": "failure", "reason": str(e)}
    finally:
        if driver:
            driver.quit()
            logger.info("WebDriver for LinkedIn scraping has been quit.")

# --- Polling Tasks ---
@celery_app.task(name="poll_gmail_for_user")
def poll_gmail_for_user(user_id: str, polling_state: dict):
    logger.info(f"Polling Gmail for user {user_id}")
    db_manager = GmailPollerDB()
    service = GmailPollingService(db_manager)
    run_async(service._run_single_user_poll_cycle(user_id, polling_state))

@celery_app.task(name="poll_gcalendar_for_user")
def poll_gcalendar_for_user(user_id: str, polling_state: dict):
    logger.info(f"Polling GCalendar for user {user_id}")
    db_manager = GCalPollerDB()
    service = GCalendarPollingService(db_manager)
    run_async(service._run_single_user_poll_cycle(user_id, polling_state))

# --- Scheduler Tasks ---
@celery_app.task(name="schedule_all_polling")
def schedule_all_polling():
    """Celery Beat task to check for and queue polling tasks for all services."""
    logger.info("Polling Scheduler: Checking for due polling tasks...")
    
    async def async_schedule():
        db_manager = GmailPollerDB()
        try:
            await db_manager.reset_stale_polling_locks("gmail")
            await db_manager.reset_stale_polling_locks("gcalendar")

            for service_name in SUPPORTED_POLLING_SERVICES:
                due_tasks_states = await db_manager.get_due_polling_tasks_for_service(service_name)
                logger.info(f"Found {len(due_tasks_states)} due tasks for {service_name}.")
                
                for task_state in due_tasks_states:
                    user_id = task_state["user_id"]
                    locked_task_state = await db_manager.set_polling_status_and_get(user_id, service_name)
                    if locked_task_state:
                        if service_name == "gmail":
                            poll_gmail_for_user.delay(user_id, locked_task_state)
                        elif service_name == "gcalendar":
                            poll_gcalendar_for_user.delay(user_id, locked_task_state)
                        logger.info(f"Dispatched polling task for {user_id} - service: {service_name}")
        finally:
            await db_manager.close()

    run_async(async_schedule())

def calculate_next_run(schedule: Dict[str, Any], last_run: Optional[datetime.datetime] = None) -> Optional[datetime.datetime]:
    """Calculates the next execution time for a scheduled task."""
    now = datetime.datetime.now(datetime.timezone.utc)
    start_time = last_run or now

    try:
        frequency = schedule.get("frequency")
        time_str = schedule.get("time", "00:00")
        hour, minute = map(int, time_str.split(':'))
        dtstart = start_time.replace(hour=hour, minute=minute, second=0, microsecond=0)

        rule = None
        if frequency == 'daily':
            rule = rrule.rrule(rrule.DAILY, dtstart=dtstart)
        elif frequency == 'weekly':
            days = schedule.get("days", [])
            if not days: return None
            weekday_map = {"Sunday": rrule.SU, "Monday": rrule.MO, "Tuesday": rrule.TU, "Wednesday": rrule.WE, "Thursday": rrule.TH, "Friday": rrule.FR, "Saturday": rrule.SA}
            byweekday = [weekday_map[day] for day in days if day in weekday_map]
            if not byweekday: return None
            rule = rrule.rrule(rrule.WEEKLY, dtstart=dtstart, byweekday=byweekday)

        if rule:
            next_run = rule.after(start_time)
            if next_run and next_run.tzinfo is None:
                next_run = next_run.replace(tzinfo=datetime.timezone.utc)
            return next_run
    except Exception as e:
        logger.error(f"Error calculating next run time for schedule {schedule}: {e}")
    return None

@celery_app.task(name="run_due_tasks")
def run_due_tasks():
    """Celery Beat task to check for and queue user-defined tasks (recurring and scheduled-once)."""
    logger.info("Scheduler: Checking for due user-defined tasks...")
    run_async(async_run_due_tasks())
    # --- Proactivity Check Placeholder ---
    # To implement proactive tasks (like daily summaries), you would:
    # 1. Fetch all users from the database.
    # 2. For each user, check their `preferences.proactivityLevel`.
    # 3. If the level is 'Proactive' or 'Balanced', check if it's time for their daily summary
    #    (respecting their timezone and `quietHours`).
    # 4. If so, dispatch a new Celery task, e.g., `generate_daily_summary.delay(user_id)`.
    # This `run_due_tasks` function is a good place to trigger that logic on a schedule.


async def async_run_due_tasks():
    db_manager = PlannerMongoManager()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        # Fetch tasks that are due and are either 'active' (recurring) or 'pending' (scheduled-once)
        query = {
            "status": {"$in": ["active", "pending"]},
            "enabled": True,
            "next_execution_at": {"$lte": now}
        }
        due_tasks_cursor = db_manager.tasks_collection.find(query)
        due_tasks = await due_tasks_cursor.to_list(length=None)

        if not due_tasks:
            logger.info("Scheduler: No user-defined tasks are due.")
            return

        logger.info(f"Scheduler: Found {len(due_tasks)} due user-defined tasks.")
        for task in due_tasks:
            logger.info(f"Scheduler: Queuing user-defined task {task['task_id']} for execution.")
            execute_task_plan.delay(task['task_id'], task['user_id'])
            
            # For recurring tasks, calculate the next run time.
            # For one-off tasks, this will effectively be cleared.
            next_run_time = None
            if task.get('schedule', {}).get('type') == 'recurring':
                next_run_time = calculate_next_run(task['schedule'], last_run=now)

            update_fields = {
                "last_execution_at": now,
                "next_execution_at": next_run_time
            }
            # One-off tasks have their next_execution_at set to None, so they won't run again.
            # Their status will be updated to 'processing' -> 'completed'/'error' by the executor.
            
            await db_manager.tasks_collection.update_one(
                {"_id": task["_id"]},
                {"$set": update_fields}
            )
            if next_run_time:
                 logger.info(f"Scheduler: Rescheduled user-defined task {task['task_id']} for {next_run_time}.")

    except Exception as e:
        logger.error(f"Scheduler: An error occurred checking user-defined tasks: {e}", exc_info=True)
    finally:
        await db_manager.close()