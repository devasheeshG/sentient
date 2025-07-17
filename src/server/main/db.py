# src/server/main/db.py
import os
import datetime
import uuid 
import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
from pymongo.errors import DuplicateKeyError
from typing import Dict, List, Optional, Any, Tuple

# Import config from the current 'main' directory
from main.config import MONGO_URI, MONGO_DB_NAME

USER_PROFILES_COLLECTION = "user_profiles" 
CHAT_HISTORY_COLLECTION = "chat_history"
NOTIFICATIONS_COLLECTION = "notifications" 
POLLING_STATE_COLLECTION = "polling_state_store" 
PROCESSED_ITEMS_COLLECTION = "processed_items_log" 
TASK_COLLECTION = "tasks"

class MongoManager:
    def __init__(self):
        self.client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        self.db = self.client[MONGO_DB_NAME]
        
        self.user_profiles_collection = self.db[USER_PROFILES_COLLECTION]
        self.chat_history_collection = self.db[CHAT_HISTORY_COLLECTION]
        self.notifications_collection = self.db[NOTIFICATIONS_COLLECTION]
        self.polling_state_collection = self.db[POLLING_STATE_COLLECTION]
        self.processed_items_collection = self.db[PROCESSED_ITEMS_COLLECTION]
        self.task_collection = self.db[TASK_COLLECTION]
        
        print(f"[{datetime.datetime.now()}] [MainServer_MongoManager] Initialized. Database: {MONGO_DB_NAME}")

    async def initialize_db(self):
        print(f"[{datetime.datetime.now()}] [MainServer_DB_INIT] Ensuring indexes for MongoManager collections...")
        
        collections_with_indexes = {
            self.user_profiles_collection: [
                IndexModel([("user_id", ASCENDING)], unique=True, name="user_id_unique_idx"),
                IndexModel([("userData.last_active_timestamp", DESCENDING)], name="user_last_active_idx"),
                IndexModel([("userData.google_services.gmail.encrypted_refresh_token", ASCENDING)], 
                           name="google_gmail_token_idx", sparse=True),
                IndexModel([("userData.onboardingComplete", ASCENDING)], name="user_onboarding_status_idx", sparse=True)
            ],
            self.chat_history_collection: [
                IndexModel([("user_id", ASCENDING), ("chat_id", ASCENDING)], name="user_chat_id_idx"),
                IndexModel([("messages.message", "text")], name="message_text_idx"),
                IndexModel([("user_id", ASCENDING), ("last_updated", DESCENDING)], name="chat_last_updated_idx"), # Kept for sorting chats
                IndexModel([("user_id", ASCENDING), ("messages.timestamp", DESCENDING)], name="message_timestamp_idx", sparse=True)
            ],
            self.notifications_collection: [
                IndexModel([("user_id", ASCENDING)], name="notification_user_id_idx"),
                IndexModel([("user_id", ASCENDING), ("notifications.timestamp", DESCENDING)], name="notification_timestamp_idx", sparse=True)
            ],
            self.polling_state_collection: [
                IndexModel([("user_id", ASCENDING), ("service_name", ASCENDING)], unique=True, name="polling_user_service_unique_idx"),
                IndexModel([
                    ("is_enabled", ASCENDING), ("next_scheduled_poll_time", ASCENDING), 
                    ("is_currently_polling", ASCENDING), ("error_backoff_until_timestamp", ASCENDING) 
                ], name="polling_due_tasks_idx"),
                IndexModel([("is_currently_polling", ASCENDING), ("last_attempted_poll_timestamp", ASCENDING)], name="polling_stale_locks_idx")
            ],
            self.processed_items_collection: [ 
                IndexModel([("user_id", ASCENDING), ("service_name", ASCENDING), ("item_id", ASCENDING)], unique=True, name="processed_item_unique_idx_main"),
                IndexModel([("processing_timestamp", DESCENDING)], name="processed_timestamp_idx_main", expireAfterSeconds=2592000) # 30 days
            ],
            self.task_collection: [
                IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="task_user_created_idx"),
                IndexModel([("user_id", ASCENDING), ("status", ASCENDING), ("priority", ASCENDING)], name="task_user_status_priority_idx"),
                IndexModel([("status", ASCENDING), ("agent_id", ASCENDING)], name="task_status_agent_idx", sparse=True), 
                IndexModel([("task_id", ASCENDING)], unique=True, name="task_id_unique_idx")
            ]
        }

        for collection, indexes in collections_with_indexes.items():
            try:
                await collection.create_indexes(indexes)
                print(f"[{datetime.datetime.now()}] [MainServer_DB_INIT] Indexes ensured for: {collection.name}")
            except Exception as e:
                print(f"[{datetime.datetime.now()}] [MainServer_DB_ERROR] Index creation for {collection.name}: {e}")

    # --- User Profile Methods ---
    async def get_user_profile(self, user_id: str) -> Optional[Dict]:
        if not user_id: return None
        return await self.user_profiles_collection.find_one({"user_id": user_id})

    async def update_user_profile(self, user_id: str, profile_data: Dict) -> bool:
        if not user_id or not profile_data: return False
        if "_id" in profile_data: del profile_data["_id"] 
        
        update_operations = {"$set": {}, "$setOnInsert": {}}
        now_utc = datetime.datetime.now(datetime.timezone.utc)

        for key, value in profile_data.items():
            update_operations["$set"][key] = value
        
        update_operations["$set"]["last_updated"] = now_utc
        update_operations["$setOnInsert"]["user_id"] = user_id
        update_operations["$setOnInsert"]["createdAt"] = now_utc
        
        if "userData" not in profile_data and not any(k.startswith("userData.") for k in profile_data):
             update_operations["$setOnInsert"]["userData"] = {}

        for key_to_set in profile_data.keys():
            if key_to_set.startswith("userData.google_services."):
                parts = key_to_set.split('.')
                if len(parts) >= 3: 
                    service_name_for_insert = parts[2] 
                    
                    user_data_on_insert = update_operations["$setOnInsert"].setdefault("userData", {})
                    google_services_on_insert = user_data_on_insert.setdefault("google_services", {})
                    google_services_on_insert.setdefault(service_name_for_insert, {})
                break 

        if not update_operations["$set"]: del update_operations["$set"] 
        if not update_operations["$setOnInsert"]: del update_operations["$setOnInsert"]
        
        if not update_operations.get("$set") and not update_operations.get("$setOnInsert"): 
            return True 

        result = await self.user_profiles_collection.update_one(
            {"user_id": user_id}, update_operations, upsert=True
        )
        return result.matched_count > 0 or result.upserted_id is not None
        
    async def update_user_last_active(self, user_id: str) -> bool:
        if not user_id: return False
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        update_payload = {
            "userData.last_active_timestamp": now_utc,
            "last_updated": now_utc
        }
        result = await self.user_profiles_collection.update_one(
            {"user_id": user_id},
            {"$set": update_payload, 
             "$setOnInsert": {"user_id": user_id, "createdAt": now_utc, "userData": {"last_active_timestamp": now_utc}}},
            upsert=True 
        )
        return result.matched_count > 0 or result.upserted_id is not None

    # --- Chat History Methods ---
    async def add_chat_message(self, user_id: str, chat_id: str, message_data: Dict) -> str:
        if not all([user_id, chat_id, message_data]):
            raise ValueError("user_id, chat_id, and message_data are required.")
        
        message_data["timestamp"] = datetime.datetime.now(datetime.timezone.utc)
        message_id = message_data.get("id", str(uuid.uuid4())) 
        message_data["id"] = message_id

        result = await self.chat_history_collection.update_one(
            {"user_id": user_id, "chat_id": chat_id},
            {"$push": {"messages": message_data},
             "$set": {"last_updated": datetime.datetime.now(datetime.timezone.utc)},
             "$setOnInsert": {"user_id": user_id, "chat_id": chat_id, "created_at": datetime.datetime.now(datetime.timezone.utc)}
            },
            upsert=True
        )
        if result.matched_count > 0 or result.upserted_id is not None:
            return message_id
        raise Exception(f"Failed to add/update chat message for user {user_id}, chat {chat_id}")

    async def get_chat_history(self, user_id: str, chat_id: str) -> List[Dict]:
        if not user_id or not chat_id: return []
        chat_doc = await self.chat_history_collection.find_one(
            {"user_id": user_id, "chat_id": chat_id}, {"messages": 1, "_id": 0}
        )
        return chat_doc.get("messages", []) if chat_doc else []

    async def get_all_chats_for_user(self, user_id: str) -> List[Dict]:
        if not user_id: return []
        cursor = self.chat_history_collection.find(
            {"user_id": user_id},
            {"chat_id": 1, "title": 1, "last_updated": 1, "_id": 0}
        ).sort("last_updated", DESCENDING)
        return await cursor.to_list(length=None)

    async def delete_chat_history(self, user_id: str, chat_id: str) -> bool:
        if not user_id or not chat_id: return False
        result = await self.chat_history_collection.delete_one({"user_id": user_id, "chat_id": chat_id})
        return result.deleted_count > 0

    async def update_chat_message(self, user_id: str, chat_id: str, message_id: str, update_data: Dict) -> bool:
        if not all([user_id, chat_id, message_id, update_data]):
            raise ValueError("user_id, chat_id, message_id, and update_data are required.")

        set_payload = {f"messages.$.{key}": value for key, value in update_data.items()}
        set_payload["last_updated"] = datetime.datetime.now(datetime.timezone.utc)
        
        result = await self.chat_history_collection.update_one(
            {"user_id": user_id, "chat_id": chat_id, "messages.id": message_id},
            {"$set": set_payload}
        )
        if result.matched_count == 0:
            print(f"[{datetime.datetime.now()}] [DB_UPDATE_WARN] No message found with ID {message_id} in chat {chat_id} for user {user_id} to update.")
            return False
        return result.modified_count > 0

    async def create_new_chat_session(self, user_id: str, chat_id: str, title: Optional[str] = "New Chat") -> bool:
        if not user_id or not chat_id: return False
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        # Use update_one with upsert to avoid race conditions and ensure idempotency.
        # If a chat with this ID somehow already exists, this does nothing.
        result = await self.chat_history_collection.update_one(
            {"user_id": user_id, "chat_id": chat_id},
            {
                "$setOnInsert": {
                    "user_id": user_id,
                    "chat_id": chat_id,
                    "title": title,
                    "messages": [],
                    "created_at": now_utc,
                    "last_updated": now_utc
                }
            },
            upsert=True
        )
        return result.upserted_id is not None

    async def rename_chat(self, user_id: str, chat_id: str, new_title: str) -> bool:
        if not all([user_id, chat_id, new_title]):
            return False
        result = await self.chat_history_collection.update_one(
            {"user_id": user_id, "chat_id": chat_id},
            {"$set": {"title": new_title, "last_updated": datetime.datetime.now(datetime.timezone.utc)}}
        )
        return result.modified_count > 0

    # --- Notification Methods ---
    async def get_notifications(self, user_id: str) -> List[Dict]:
        if not user_id: return []
        user_doc = await self.notifications_collection.find_one(
            {"user_id": user_id}, {"notifications": 1}
        )
        notifications_list = user_doc.get("notifications", []) if user_doc else []

        # Serialize datetime objects before returning, as they are not JSON-serializable by default.
        for notification in notifications_list:
            if isinstance(notification.get("timestamp"), datetime.datetime):
                notification["timestamp"] = notification["timestamp"].isoformat()
        return notifications_list

    async def add_notification(self, user_id: str, notification_data: Dict) -> Optional[Dict]:
        if not user_id or not notification_data: return None
        notification_data["timestamp"] = datetime.datetime.now(datetime.timezone.utc)
        notification_data["id"] = str(uuid.uuid4())
        result = await self.notifications_collection.update_one(
            {"user_id": user_id},
            {"$push": {
                "notifications": {
                    "$each": [notification_data],
                    "$position": 0, # Add to the beginning of the array
                    "$slice": -50
                }
            },
             "$setOnInsert": {"user_id": user_id, "created_at": datetime.datetime.now(datetime.timezone.utc)}},
            upsert=True
        )
        if result.matched_count > 0 or result.upserted_id is not None:
            return notification_data
        return None

    async def delete_notification(self, user_id: str, notification_id: str) -> bool:
        if not user_id or not notification_id: return False
        result = await self.notifications_collection.update_one(
            {"user_id": user_id},
            {"$pull": {"notifications": {"id": notification_id}}}
        )
        return result.modified_count > 0

    # --- Polling State Store Methods ---
    async def get_polling_state(self, user_id: str, service_name: str) -> Optional[Dict[str, Any]]:
        if not user_id or not service_name: return None
        return await self.polling_state_collection.find_one(
            {"user_id": user_id, "service_name": service_name}
        )

    async def update_polling_state(self, user_id: str, service_name: str, state_data: Dict[str, Any]) -> bool: 
        if not user_id or not service_name or state_data is None: return False
        for key, value in state_data.items(): 
            if isinstance(value, datetime.datetime):
                state_data[key] = value.replace(tzinfo=datetime.timezone.utc) if value.tzinfo is None else value.astimezone(datetime.timezone.utc)
        
        # Prevent conflict errors by not trying to $set fields that are part of the unique index
        # or are immutable.
        if '_id' in state_data:
            del state_data['_id']
        if 'user_id' in state_data:
            del state_data['user_id']
        if 'service_name' in state_data:
            del state_data['service_name']
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        state_data["last_updated_at"] = now_utc

        result = await self.polling_state_collection.update_one(
            {"user_id": user_id, "service_name": service_name}, 
            {"$set": state_data, "$setOnInsert": {"created_at": now_utc, "user_id": user_id, "service_name": service_name}}, 
            upsert=True
        )
        return result.matched_count > 0 or result.upserted_id is not None

    async def close(self):
        if self.client:
            self.client.close()
            print(f"[{datetime.datetime.now()}] [MainServer_MongoManager] MongoDB connection closed.")