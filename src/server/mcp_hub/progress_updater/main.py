import os
import motor.motor_asyncio
import datetime
from typing import Dict, Any, Optional


from dotenv import load_dotenv
from fastmcp import FastMCP, Context
from . import auth

# Load .env file for 'dev-local' environment.
ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev-local')
if ENVIRONMENT == 'dev-local':
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path=dotenv_path)
# --- DB Setup ---
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB_NAME]
tasks_collection = db["tasks"]

# --- MCP Server ---
mcp = FastMCP(
    name="ProgressUpdaterServer",
    instructions="A server for updating the progress of a running task."
)

@mcp.tool
async def update_progress(ctx: Context, task_id: str, update_message: str, block_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Updates the progress of a specific task. To be called by an executor agent.
    """
    try:
        user_id = auth.get_user_id_from_context(ctx)
        
        progress_update = {
            "message": update_message,
            "timestamp": datetime.datetime.now(datetime.timezone.utc)
        }
        
        # Update the tasks collection (existing logic)
        task_result = await tasks_collection.update_one(
            {"task_id": task_id, "user_id": user_id},
            {"$push": {"progress_updates": progress_update}}
        )
        
        if task_result.matched_count == 0:
            return {"status": "failure", "error": "Task not found or user mismatch."}
            
        return {"status": "success", "result": "Progress updated successfully."}
    except Exception as e:
        return {"status": "failure", "error": str(e)}

if __name__ == "__main__":
    host = os.getenv("MCP_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_SERVER_PORT", 9011))
    mcp.run(transport="sse", host=host, port=port)