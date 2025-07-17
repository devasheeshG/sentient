# src/server/workers/extractor/db.py
import motor.motor_asyncio
from pymongo import IndexModel, DESCENDING, ASCENDING
import datetime
import uuid
import logging
from typing import Dict

from workers.extractor.config import MONGO_URI, MONGO_DB_NAME

logger = logging.getLogger(__name__)

class ExtractorMongoManager:
    """
    A simplified MongoDB manager for the extractor worker, primarily for logging.
    """
    def __init__(self):
        self.client = None
        try:
            self.client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
            self.db = self.client[MONGO_DB_NAME]
            self.processed_log_collection = self.db["extractor_processed_log"]
            logger.info("ExtractorMongoManager initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize ExtractorMongoManager: {e}")
            raise

    async def initialize_db(self):
        """Ensures necessary indexes exist."""
        try:
            indexes_to_ensure = [
                IndexModel([("user_id", ASCENDING), ("original_event_id", ASCENDING)], name="processed_event_unique_idx", unique=True),
                IndexModel([("processed_at", DESCENDING)], expireAfterSeconds=2592000) # 30 days TTL
            ]
            await self.processed_log_collection.create_indexes(indexes_to_ensure)
            logger.info("Extractor MongoDB indexes ensured.")
        except Exception as e:
            logger.error(f"Error ensuring extractor MongoDB indexes: {e}")

    async def get_user_profile(self, user_id: str) -> Dict | None:
        """Fetches a user profile by user_id, projecting only necessary fields."""
        if not self.client:
            logger.error("DB client not initialized.")
            return None
        return await self.processed_log_collection.database['user_profiles'].find_one(
            {"user_id": user_id},
            {"userData.personalInfo": 1}
        )

    async def log_extraction_result(self, original_event_id: str, user_id: str, memory_count: int, action_count: int):
        """Logs the result of an extraction process."""
        try:
            await self.processed_log_collection.insert_one({
                "original_event_id": original_event_id,
                "user_id": user_id,
                "memory_items_extracted": memory_count,
                "action_items_extracted": action_count,
                "processed_at": datetime.datetime.now(datetime.timezone.utc)
            })
        except Exception as e:
            logger.error(f"Failed to log extraction result for event {original_event_id}: {e}")

    async def is_event_processed(self, user_id: str, event_id: str) -> bool:
        """Checks if an event has already been processed and logged."""
        count = await self.processed_log_collection.count_documents({
            "user_id": user_id, "original_event_id": event_id
        })
        return count > 0

    async def close(self):
        if self.client:
            self.client.close()
            logger.info("Extractor MongoDB connection closed.")