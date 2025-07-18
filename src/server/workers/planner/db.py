import uuid
import datetime
import logging
import motor.motor_asyncio
import logging
from typing import List, Dict, Any, Optional
import json

from workers.planner.config import MONGO_URI, MONGO_DB_NAME, INTEGRATIONS_CONFIG
from workers.utils.crypto import aes_decrypt

logger = logging.getLogger(__name__)

logger = logging.getLogger(__name__)

def get_all_mcp_descriptions() -> Dict[str, str]:
    """
    Creates a dictionary of all available services and their high-level descriptions
    from the main server's integration config.
    """
    if not INTEGRATIONS_CONFIG:
        logging.warning("INTEGRATIONS_CONFIG is empty. No tools will be available to the planner.")
        return {}
    
    mcp_descriptions = {}
    for name, config in INTEGRATIONS_CONFIG.items():
        display_name = config.get("display_name")
        description = config.get("description")
        if display_name and description:
            # Use the simple name (e.g., 'gmail') as the key for the planner
            mcp_descriptions[name] = description
            
    return mcp_descriptions


class PlannerMongoManager:
    """A MongoDB manager for the planner worker."""
    def __init__(self):
        self.client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        self.db = self.client[MONGO_DB_NAME]
        self.user_profiles_collection = self.db["user_profiles"]
        self.tasks_collection = self.db["tasks"]
        logger.info("PlannerMongoManager initialized.")

    async def create_initial_task(self, user_id: str, description: str, action_items: list, topics: list, original_context: dict, source_event_id: str) -> str:
        """Creates an initial task document when an action item is first processed."""
        task_id = str(uuid.uuid4())
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        task_doc = {
            "task_id": task_id,
            "user_id": user_id,
            "description": description,
            "status": "context_verification", # New initial status
            "priority": 1,
            "plan": [], # Plan is empty initially
            "action_items": action_items,
            "topics": topics,
            "original_context": original_context,
            "source_event_id": source_event_id,
            "clarifying_questions": [],
            "progress_updates": [],
            "created_at": now_utc,
            "updated_at": now_utc,
            "result": None,
            "error": None,
        }
        await self.tasks_collection.insert_one(task_doc)
        logger.info(f"Created initial task {task_id} for user {user_id}")
        return task_id

    async def create_proactive_task(self, user_id: str, description: str, original_context: dict, source_event_id: str) -> str:
        """Creates a new task from a proactive source (e.g., email poller), auto-assigned to AI."""
        task_id = str(uuid.uuid4())
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        task_doc = {
            "task_id": task_id,
            "user_id": user_id,
            "description": description,
            "status": "pending",
            "assigned_to": "ai", # Auto-assign to AI
            "priority": 1, # Default priority
            "plan": [],
            "original_context": original_context,
            "source_event_id": source_event_id,
            "progress_updates": [],
            "agent_history": [],
            "created_at": now_utc,
            "updated_at": now_utc,
        }
        await self.tasks_collection.insert_one(task_doc)
        logger.info(f"Created proactive task {task_id} for user {user_id} from event {source_event_id}")
        return task_id

    async def update_task_field(self, task_id: str, fields: dict):
        """Updates specific fields of a task document."""
        await self.tasks_collection.update_one(
            {"task_id": task_id},
            {"$set": fields}
        )
        logger.info(f"Updated fields for task {task_id}: {list(fields.keys())}")

    async def update_task_with_plan(self, task_id: str, plan_data: dict):
        """Updates a task with a generated plan and sets it to pending approval."""
        description = plan_data.get("description", "Proactively generated plan")
        plan_steps = plan_data.get("plan", [])

        update_doc = {
            "description": description,
            "plan": plan_steps,
            "status": "approval_pending", # The final status after planning is complete
            "updated_at": datetime.datetime.now(datetime.timezone.utc)
        }

        result = await self.tasks_collection.update_one(
            {"task_id": task_id},
            {"$set": update_doc}
        )
        logger.info(f"Updated task {task_id} with a generated plan. Matched: {result.matched_count}")
        
    async def update_task_with_questions(self, task_id: str, status: str, questions: list):
        """Updates a task with clarifying questions and a new status."""
        update_doc = {
            "status": status,
            "clarifying_questions": questions,
            "updated_at": datetime.datetime.now(datetime.timezone.utc)
        }
        await self.tasks_collection.update_one({"task_id": task_id}, {"$set": update_doc})
        logger.info(f"Updated task {task_id} with {len(questions)} clarifying questions.")

    async def get_task(self, task_id: str) -> Optional[Dict]:
        """Fetches a single task by its ID."""
        return await self.tasks_collection.find_one({"task_id": task_id})

    async def update_task_status(self, task_id: str, status: str, details: Optional[Dict] = None):
        """Updates the status and optionally other fields of a task."""
        update_doc = {"status": status, "updated_at": datetime.datetime.now(datetime.timezone.utc)}
        if details:
            if "error" in details:
                update_doc["error"] = details["error"]
        await self.tasks_collection.update_one({"task_id": task_id}, {"$set": update_doc})
        logger.info(f"Updated status of task {task_id} to {status}")

    async def save_plan_as_task(self, user_id: str, description: str, plan: list, original_context: dict, source_event_id: str):
        """Saves a generated plan to the tasks collection for user approval."""
        task_id = str(uuid.uuid4())
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        task_doc = {
            "task_id": task_id,
            "user_id": user_id,
            "description": description,
            "status": "approval_pending",
            "priority": 1,
            "plan": plan,
            "original_context": original_context,
            "source_event_id": source_event_id,
            "progress_updates": [],
            "created_at": now_utc,
            "updated_at": now_utc,
            "result": None,
            "error": None,
            "agent_id": "planner_agent"
        }
        await self.tasks_collection.insert_one(task_doc)
        logger.info(f"Saved new plan with task_id: {task_id} for user: {user_id}")
        return task_id

    async def close(self):
        if self.client:
            self.client.close()
            logger.info("Planner MongoDB connection closed.")