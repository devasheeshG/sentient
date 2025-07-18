import logging
import uuid
import datetime
from typing import List, Dict, Any, AsyncGenerator

from main.db import MongoManager
from main.llm import get_qwen_assistant
from main.config import INTEGRATIONS_CONFIG, SUPERMEMORY_MCP_BASE_URL, SUPERMEMORY_MCP_ENDPOINT_SUFFIX

logger = logging.getLogger(__name__)

def msg_to_str(msg: Dict[str, Any]) -> str:
    """Converts a Qwen agent message object to a string for streaming."""
    if msg.get('role') == 'assistant' and msg.get('function_call'):
        return "" # Don't stream tool calls directly
    elif msg.get('role') == 'function':
        return "" # Don't stream tool results directly
    elif msg.get('role') == 'assistant' and msg.get('content'):
        return msg.get('content', '')
    return ''

async def generate_task_chat_stream(
    user_id: str,
    task_id: str,
    messages: List[Dict[str, Any]],
    db_manager: MongoManager
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Main async generator for handling an interactive chat session for a single task.
    """
    assistant_message_id = str(uuid.uuid4())
    full_response_content = ""
    
    try:
        # 1. Fetch Task and User Profile
        task = await db_manager.task_collection.find_one({"task_id": task_id, "user_id": user_id})
        if not task:
            raise ValueError("Task not found or access denied.")

        user_profile = await db_manager.get_user_profile(user_id)
        if not user_profile:
            raise ValueError("User profile not found.")

        # 2. Construct Tools and System Prompt
        user_integrations = user_profile.get("userData", {}).get("integrations", {})
        supermemory_user_id = user_profile.get("userData", {}).get("supermemory_user_id")

        active_mcp_servers = {}
        # Add all connected/built-in tools for the user
        for tool_name, config in INTEGRATIONS_CONFIG.items():
            is_connected = user_integrations.get(tool_name, {}).get("connected", False)
            is_builtin = config.get("auth_type") == "builtin"
            mcp_config = config.get("mcp_server_config")
            
            if mcp_config and (is_connected or is_builtin):
                if tool_name == "supermemory" and supermemory_user_id:
                    active_mcp_servers["supermemory"] = {
                        "transport": "sse",
                        "url": f"{SUPERMEMORY_MCP_BASE_URL.rstrip('/')}/{supermemory_user_id}{SUPERMEMORY_MCP_ENDPOINT_SUFFIX}"
                    }
                elif mcp_config.get("url"):
                    active_mcp_servers[mcp_config["name"]] = {"url": mcp_config["url"], "headers": {"X-User-ID": user_id}}
        
        tools_config = [{"mcpServers": active_mcp_servers}]

        system_prompt = (
            f"You are an expert AI assistant assigned to the task: '{task['description']}'. "
            "Your goal is to complete this task by interacting with the user and using the available tools. "
            "Follow this process:\n"
            "1. **Context Check**: First, use your memory (`supermemory-search`) and review the conversation history to see if you have all the information needed.\n"
            "2. **Clarify**: If critical information is missing, ask the user for clarification. Be specific about what you need.\n"
            "3. **Plan**: Once you have enough information, create a step-by-step plan. Present this plan to the user for approval before you start executing.\n"
            "4. **Execute**: After the user approves the plan, execute it step-by-step using your tools. Provide updates using the `progress_updater-update_progress` tool after each significant action.\n"
            "5. **Final Answer**: When the task is complete, provide a final, comprehensive summary of what you did and the outcome. Wrap your final answer in `<answer>` tags."
        )

        # 3. Initialize and Run Agent
        agent = get_qwen_assistant(system_message=system_prompt, function_list=tools_config)
        
        # Ensure messages are in the correct format for Qwen Agent
        qwen_messages = [{"role": m["role"], "content": m["content"]} for m in messages]
        
        last_yielded_content_str = ""
        for new_history_step in agent.run(messages=qwen_messages):
            if isinstance(new_history_step, list) and new_history_step:
                assistant_turn_start_index = next((i + 1 for i in range(len(new_history_step) - 1, -1, -1) if new_history_step[i].get('role') == 'user'), 0)
                assistant_messages = new_history_step[assistant_turn_start_index:]
                current_turn_str = "".join(msg_to_str(m) for m in assistant_messages)
                
                if len(current_turn_str) > len(last_yielded_content_str):
                    new_chunk = current_turn_str[len(last_yielded_content_str):]
                    full_response_content += new_chunk
                    yield {"type": "assistantStream", "token": new_chunk, "done": False, "messageId": assistant_message_id}
                    last_yielded_content_str = current_turn_str

    except Exception as e:
        logger.error(f"Error in task chat stream for task {task_id}: {e}", exc_info=True)
        yield {"type": "error", "message": str(e)}
    
    finally:
        # 4. Save updated history to DB
        if full_response_content:
            assistant_final_message = {"role": "assistant", "content": full_response_content, "id": assistant_message_id}
            all_messages = messages + [assistant_final_message]
            await db_manager.task_collection.update_one(
                {"task_id": task_id},
                {"$set": {"agent_history": all_messages, "updated_at": datetime.datetime.now(datetime.timezone.utc)}}
            )
        yield {"type": "assistantStream", "token": "", "done": True, "messageId": assistant_message_id}