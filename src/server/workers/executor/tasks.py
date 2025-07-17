import os
import json
import datetime
import asyncio
import motor.motor_asyncio
import logging
from typing import Dict, Any, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from main.analytics import capture_event
from qwen_agent.agents import Assistant
from workers.celery_app import celery_app
from workers.utils.api_client import notify_user

# Load environment variables for the worker from its own config
from workers.executor.config import (MONGO_URI, MONGO_DB_NAME,
                                     INTEGRATIONS_CONFIG, OPENAI_API_BASE_URL,
                                     OPENAI_API_KEY, OPENAI_MODEL_NAME, SUPERMEMORY_MCP_BASE_URL, SUPERMEMORY_MCP_ENDPOINT_SUFFIX)

# Setup logger for this module
logger = logging.getLogger(__name__)

# --- LLM Config for Executor ---
llm_cfg = {
    'model': OPENAI_MODEL_NAME,
    'model_server': OPENAI_API_BASE_URL,
    'api_key': OPENAI_API_KEY,
}


# --- Database Connection within Celery Task ---
def get_db_client():
    return motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)[MONGO_DB_NAME]

async def update_task_status(db, task_id: str, status: str, user_id: str, details: Dict = None):
    update_doc = {"status": status, "updated_at": datetime.datetime.now(datetime.timezone.utc)}
    task_description = ""
    
    if details:
        if "result" in details:
            update_doc["result"] = details["result"]
        if "error" in details:
            update_doc["error"] = details["error"]
    
    task_doc = await db.tasks.find_one({"task_id": task_id}, {"description": 1})
    if task_doc:
        task_description = task_doc.get("description", "Unnamed Task")

    logger.info(f"Updating task {task_id} status to '{status}' with details: {details}")
    await db.tasks.update_one(
        {"task_id": task_id, "user_id": user_id},
        {"$set": update_doc}
    )

    if status in ["completed", "error"]:
        notification_message = f"Task '{task_description}' has finished with status: {status}."
        notification_type = "taskCompleted" if status == "completed" else "taskFailed"
        await notify_user(user_id, notification_message, task_id, notification_type=notification_type)

async def add_progress_update(db, task_id: str, user_id: str, message: str):
    logger.info(f"Adding progress update to task {task_id}: '{message}'")
    progress_update = {"message": message, "timestamp": datetime.datetime.now(datetime.timezone.utc)}
    
    await db.tasks.update_one(
        {"task_id": task_id, "user_id": user_id},
        {"$push": {"progress_updates": progress_update}}
    )

@celery_app.task(name="execute_task_plan")
def execute_task_plan(task_id: str, user_id: str):
    logger.info(f"Celery worker received task 'execute_task_plan' for task_id: {task_id}, user_id: {user_id}")
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(async_execute_task_plan(task_id, user_id))


async def async_execute_task_plan(task_id: str, user_id: str):
    db = get_db_client()
    task = await db.tasks.find_one({"task_id": task_id, "user_id": user_id})

    if not task:
        logger.error(f"Executor: Task {task_id} not found for user {user_id}.")
        return {"status": "error", "message": "Task not found."}
    
    logger.info(f"Executor started processing task {task_id} for user {user_id}.")
    await update_task_status(db, task_id, "processing", user_id)
    await add_progress_update(db, task_id, user_id, "Executor has picked up the task and is starting execution.")

    user_profile = await db.user_profiles.find_one({"user_id": user_id})
    personal_info = user_profile.get("userData", {}).get("personalInfo", {}) if user_profile else {}
    preferences = user_profile.get("userData", {}).get("preferences", {}) if user_profile else {}
    user_name = personal_info.get("name", "User")
    user_location_raw = personal_info.get("location", "Not specified")
    if isinstance(user_location_raw, dict):
        user_location = f"latitude: {user_location_raw.get('latitude')}, longitude: {user_location_raw.get('longitude')}"
    else:
        user_location = user_location_raw

    # 1. Determine required and available tools for the user
    required_tools_from_plan = {step['tool'] for step in task.get('plan', [])}
    logger.info(f"Task {task_id}: Plan requires tools: {required_tools_from_plan}")
    
    user_integrations = user_profile.get("userData", {}).get("integrations", {}) if user_profile else {}
    google_auth_mode = user_profile.get("userData", {}).get("googleAuth", {}).get("mode", "default")
    
    # Construct Supermemory URL from stored user ID
    supermemory_user_id = user_profile.get("userData", {}).get("supermemory_user_id") if user_profile else None
    
    active_mcp_servers = {}

    # Always connect progress_updater
    progress_updater_config = INTEGRATIONS_CONFIG.get("progress_updater", {}).get("mcp_server_config")
    if progress_updater_config:
        active_mcp_servers[progress_updater_config["name"]] = {"url": progress_updater_config["url"], "headers": {"X-User-ID": user_id}}

    # Always connect supermemory if available for user
    if supermemory_user_id:
        active_mcp_servers["supermemory"] = {
            "transport": "sse",
            "url": f"{SUPERMEMORY_MCP_BASE_URL.rstrip('/')}/{supermemory_user_id}{SUPERMEMORY_MCP_ENDPOINT_SUFFIX}"
        }

    # Connect tools specified in the plan if they are available to the user
    for tool_name in required_tools_from_plan:
        if tool_name not in INTEGRATIONS_CONFIG:
            logger.warning(f"Task {task_id}: Plan requires tool '{tool_name}' which is not in server config.")
            continue

        config = INTEGRATIONS_CONFIG[tool_name]
        mcp_config = config.get("mcp_server_config")
        
        # Skip if no MCP config or if it's a tool we handle specially or exclude
        if not mcp_config or tool_name in ["progress_updater", "supermemory", "chat_tools"]:
            continue
            
        # Check availability
        is_google_service = tool_name.startswith('g')
        is_available_via_custom = is_google_service and google_auth_mode == 'custom'
        is_builtin = config.get("auth_type") == "builtin"
        is_connected_via_oauth = user_integrations.get(tool_name, {}).get("connected", False)

        if is_builtin or is_connected_via_oauth or is_available_via_custom:
            active_mcp_servers[mcp_config["name"]] = {"url": mcp_config["url"], "headers": {"X-User-ID": user_id}}
        else:
            logger.warning(f"Task {task_id}: Plan requires tool '{tool_name}' but it is not available/connected for user {user_id}.")
    tools_config = [{"mcpServers": active_mcp_servers}]
    logger.info(f"Task {task_id}: Executor configured with tools: {list(active_mcp_servers.keys())}")

    user_timezone_str = personal_info.get("timezone", "UTC")
    try:
        user_timezone = ZoneInfo(user_timezone_str)
    except ZoneInfoNotFoundError:
        logger.warning(f"Invalid timezone '{user_timezone_str}' for user {user_id}. Defaulting to UTC.")
        user_timezone = ZoneInfo("UTC")
    current_user_time = datetime.datetime.now(user_timezone).strftime('%Y-%m-%d %H:%M:%S %Z')

    plan_description = task.get("description", "Unnamed plan")
    original_context_data = task.get("original_context", {})
    original_context_str = json.dumps(original_context_data, indent=2, default=str) if original_context_data else "No original context provided."

    # Incorporate AI Persona into system prompt
    agent_name = preferences.get('agentName', 'Sentient')
    verbosity = preferences.get('responseVerbosity', 'Balanced')
    humor_level = preferences.get('humorLevel', 'Balanced')
    emoji_usage = "You can use emojis in your final answer." if preferences.get('useEmojis', True) else "You should not use emojis."

    full_plan_prompt = (
        f"You are {agent_name}, a resourceful and autonomous executor agent. Your goal is to complete the user's request by intelligently following the provided plan. Your tone should be **{humor_level}** and your final answer should be **{verbosity}**. {emoji_usage}\n\n"
        f"**User Context:**\n"
        f"- **User's Name:** {user_name}\n"
        f"- **User's Location:** {user_location}\n"
        f"- **Current Date & Time:** {current_user_time}\n\n"
        f"Your task ID is '{task_id}'.\n\n"
        f"The original context that triggered this plan is:\n---BEGIN CONTEXT---\n{original_context_str}\n---END CONTEXT---\n\n"
        f"**Primary Objective:** '{plan_description}'\n\n"
        f"**The Plan to Execute:**\n" +
        "\n".join([f"- Step {i+1}: Use the '{step['tool']}' tool to '{step['description']}'" for i, step in enumerate(task.get("plan", []))]) + "\n\n"
        "**EXECUTION STRATEGY:**\n"
        "1.  **Map Plan to Tools:** The plan provides a high-level tool name (e.g., 'gmail', 'gdrive'). You must map this to the specific functions available to you (e.g., `gmail-send_email`, `gdrive-gdrive_search`).\n"
        "2.  **Be Resourceful & Fill Gaps:** The plan is a guideline. If a step is missing information (e.g., an email address for a manager, a document name), your first action for that step MUST be to use the `supermemory-search` tool to find the missing information. Do not proceed with incomplete information.\n"
        "3.  **Remember New Information:** If you discover a new, permanent fact about the user during your execution (e.g., you find their manager's email is 'boss@example.com'), you MUST use `supermemory-addToSupermemory` to save it.\n"
        "4.  **Report Progress & Failures:** You MUST call the `progress_updater-update_progress` tool to report your status after each major step or when you encounter an error. If a tool fails, analyze the error, report it, and try an alternative approach to achieve the objective. Do not give up easily.\n"
        "5.  **Provide a Final, Detailed Answer:** Once all steps are completed, you MUST provide a final, comprehensive answer to the user. This is not a tool call. Your final response should be a natural language summary of everything you did and found. Include key results, links to created documents, summaries of information found, and confirmation of actions taken. Do NOT just say 'Task completed.' Be thorough and informative.\n"
        "6.  **Contact Information:** To find contact details like phone numbers or emails, use the `gpeople` tool before attempting to send an email or make a call.\n"
        "\nNow, begin your work. Think step-by-step and start executing the plan."
    )
    
    try:
        await add_progress_update(db, task_id, user_id, f"Initializing executor agent with tools: {list(active_mcp_servers.keys())}")
        
        executor_agent = Assistant(
            llm=llm_cfg, 
            function_list=tools_config,
            system_message="You are an autonomous executor agent. Your sole purpose is to execute the given plan step-by-step using the available tools. You MUST call the 'update_progress' tool after each step to report on your progress."
        )
        
        messages = [{'role': 'user', 'content': full_plan_prompt}]
        
        logger.info(f"Task {task_id}: Starting agent run.")
        final_history = None
        for responses in executor_agent.run(messages=messages):
            final_history = responses

        logger.info(f"Task {task_id}: Agent run finished.")
        final_content = "Plan execution finished with no specific output."
        if final_history and final_history[-1]['role'] == 'assistant':
            content = final_history[-1].get('content')
            if isinstance(content, str):
                if content.strip().startswith('<think>'):
                    content = content.replace('<think>', '').replace('</think>', '').strip()
                final_content = content

        logger.info(f"Task {task_id}: Final result: {final_content}")
        await add_progress_update(db, task_id, user_id, "Execution script finished.")
        capture_event(user_id, "task_execution_succeeded", {
            "task_id": task_id,
            "tool_count": len(task.get("plan", [])),
            "is_recurring": task.get("schedule", {}).get("type") == "recurring"
        })
        await update_task_status(db, task_id, "completed", user_id, details={"result": final_content})

        return {"status": "success", "result": final_content}

    except Exception as e:
        error_message = f"Executor agent failed: {str(e)}"
        logger.error(f"Task {task_id}: {error_message}", exc_info=True)
        await add_progress_update(db, task_id, user_id, f"An error occurred during execution: {error_message}")
        await update_task_status(db, task_id, "error", user_id, details={"error": error_message})
        return {"status": "error", "message": error_message}