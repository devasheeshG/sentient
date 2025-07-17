import datetime
import uuid
import os
import json
import asyncio
import logging
import threading
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import List, Dict, Any, Tuple, AsyncGenerator, Optional

from main.db import MongoManager
from main.llm import get_qwen_assistant
from main.config import INTEGRATIONS_CONFIG, SUPERMEMORY_MCP_BASE_URL, SUPERMEMORY_MCP_ENDPOINT_SUFFIX
from main.chat.prompts import TOOL_SELECTOR_SYSTEM_PROMPT
from json_extractor import JsonExtractor

logger = logging.getLogger(__name__)

async def _select_relevant_tools(query: str, available_tools_map: Dict[str, str]) -> List[str]:
    """
    Uses a lightweight LLM call to select relevant tools for a given query.
    This now runs the synchronous generator in a thread to avoid blocking.
    """
    if not available_tools_map:
        return []

    try:
        tools_description = "\n".join(f"- `{name}`: {desc}" for name, desc in available_tools_map.items())
        prompt = f"User Query: \"{query}\"\n\nAvailable Tools:\n{tools_description}"

        selector_agent = get_qwen_assistant(system_message=TOOL_SELECTOR_SYSTEM_PROMPT, function_list=[])
        messages = [{'role': 'user', 'content': prompt}]

        def _run_selector_sync():
            """Synchronous worker function to run the generator."""
            final_content_str = ""
            for chunk in selector_agent.run(messages=messages):
                if isinstance(chunk, list) and chunk:
                    last_message = chunk[-1]
                    if last_message.get("role") == "assistant" and isinstance(last_message.get("content"), str):
                        final_content_str = last_message["content"]
            return final_content_str

        # Run the synchronous function in a separate thread
        final_content_str = await asyncio.to_thread(_run_selector_sync)
        
        selected_tools = JsonExtractor.extract_valid_json(final_content_str)
        if isinstance(selected_tools, list):
            logger.info(f"Tool selector identified relevant tools: {selected_tools}")
            return selected_tools
        return []
    except Exception as e:
        logger.error(f"Error during tool selection LLM call: {e}", exc_info=True)
        return list(available_tools_map.keys())

def _get_tool_lists(user_integrations: Dict) -> Tuple[Dict, Dict]:
    """Separates tools into connected and disconnected lists."""
    connected_tools = {}
    disconnected_tools = {}
    for tool_name, config in INTEGRATIONS_CONFIG.items():
        # We only care about tools that require user connection (oauth or manual)
        if config.get("auth_type") not in ["oauth", "manual"]:
            continue

        if user_integrations.get(tool_name, {}).get("connected", False):
            connected_tools[tool_name] = config.get("description", "")
        else:
            disconnected_tools[tool_name] = config.get("description", "")
    return connected_tools, disconnected_tools

async def generate_chat_llm_stream(
    user_id: str,
    messages: List[Dict[str, Any]],
    user_context: Dict[str, Any], # Basic context like name, timezone
    preferences: Dict[str, Any],  # Detailed AI personality preferences
    db_manager: MongoManager) -> AsyncGenerator[Dict[str, Any], None]:
    assistant_message_id = str(uuid.uuid4())

    try:
        username = user_context.get("name", "User")
        timezone_str = user_context.get("timezone", "UTC")
        location_raw = user_context.get("location")

        if isinstance(location_raw, dict) and 'latitude' in location_raw:
            location = f"latitude: {location_raw.get('latitude')}, longitude: {location_raw.get('longitude')}"
        elif isinstance(location_raw, str):
            location = location_raw
        else:
            location = "Not specified"
        try:
            user_timezone = ZoneInfo(timezone_str)
        except ZoneInfoNotFoundError:
            user_timezone = ZoneInfo("UTC")

        current_user_time = datetime.datetime.now(user_timezone).strftime('%Y-%m-%d %H:%M:%S %Z')

        user_profile = await db_manager.get_user_profile(user_id)
        user_integrations = user_profile.get("userData", {}).get("integrations", {}) if user_profile else {}
        supermemory_user_id = user_profile.get("userData", {}).get("supermemory_user_id") if user_profile else None

        # Get both connected and disconnected tools
        connected_tools, disconnected_tools = _get_tool_lists(user_integrations)

        all_available_mcp_servers = {}
        tool_name_to_desc_map = connected_tools.copy() # Start with connected tools

        if supermemory_user_id:
            full_supermemory_mcp_url = f"{SUPERMEMORY_MCP_BASE_URL.rstrip('/')}/{supermemory_user_id}{SUPERMEMORY_MCP_ENDPOINT_SUFFIX}"
            all_available_mcp_servers["supermemory"] = {"transport": "sse", "url": full_supermemory_mcp_url}
            # Add built-in tools to the description map for the selector
            tool_name_to_desc_map["supermemory"] = INTEGRATIONS_CONFIG.get("supermemory", {}).get("description")

        # Add other built-in tools
        for tool_name, config in INTEGRATIONS_CONFIG.items():
            if config.get("auth_type") == "builtin":
                 tool_name_to_desc_map[tool_name] = config.get("description")

        # Now, populate MCP servers for all available (connected + built-in) tools
        for tool_name in tool_name_to_desc_map.keys():
            config = INTEGRATIONS_CONFIG.get(tool_name, {})
            if config:
                mcp_config = config.get("mcp_server_config")
                if mcp_config and mcp_config.get("url"):
                    all_available_mcp_servers[mcp_config["name"]] = {"url": mcp_config["url"], "headers": {"X-User-ID": user_id}}

        last_user_query = messages[-1].get("content", "") if messages else ""
        relevant_tool_names = await _select_relevant_tools(last_user_query, tool_name_to_desc_map)

        mandatory_tools = {"journal", "supermemory", "chat_tools"}
        final_tool_names = set(relevant_tool_names) | mandatory_tools

        filtered_mcp_servers = {}
        for server_name, server_config in all_available_mcp_servers.items():
            tool_name_for_server = next((tn for tn, tc in INTEGRATIONS_CONFIG.items() if tc.get("mcp_server_config", {}).get("name") == server_name), None)
            if tool_name_for_server in final_tool_names:
                filtered_mcp_servers[server_name] = server_config

        logger.info(f"Final tools for agent: {list(filtered_mcp_servers.keys())}")
        tools = [{"mcpServers": filtered_mcp_servers}]
        
    except Exception as e:
        logger.error(f"Failed during initial setup for chat stream for user {user_id}: {e}", exc_info=True)
        yield {"type": "error", "message": "Failed to set up chat stream."}
        return

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[Optional[Any]] = asyncio.Queue()
    stream_interrupted = False
    
    # Dynamically construct persona instructions
    agent_name = preferences.get('agentName', 'Sentient')
    verbosity = preferences.get('responseVerbosity', 'Balanced')
    humor_level = preferences.get('humorLevel', 'Balanced')
    emoji_usage = "You can use emojis to add personality." if preferences.get('useEmojis', True) else "You should not use emojis."

    disconnected_tools_list_str = "\n".join([f"- `{name}`: {desc}" for name, desc in disconnected_tools.items()])
    disconnected_tools_prompt_section = (
        f"**Disconnected Tools (User needs to connect these in Settings):**\n{disconnected_tools_list_str}\n\n"
        if disconnected_tools_list_str else ""
    )

    system_prompt = (
        f"You are {agent_name}, a personalized AI assistant. Your goal is to be as helpful as possible by using your available tools for information retrieval or by creating journal entries for actions that need to be planned and executed.\n\n"
        f"**Critical Instructions:**\n"
        f"1. **Handle Disconnected Tools:** You have a list of tools the user has not connected yet. If the user's query clearly refers to a capability from this list (e.g., asking to 'send a slack message' when Slack is disconnected), you MUST stop and politely inform the user that they need to connect the tool in the Settings > Integrations page. Do not proceed with other tools.\n"
        f"2. **Analyze User Intent:** First, determine if the user is asking for information (a 'retrieval' query) or asking you to perform an action (an 'action' query).\n"
        f"3. **Retrieval Queries:** For requests to find, list, search, or read information (e.g., 'what's the weather?', 'search for emails about project X', 'what's on my calendar?'), use the appropriate tools from your available tool list to get the information and answer the user directly.\n"
        f"4. **Action Queries:** For requests to perform an action (e.g., 'send an email', 'create a document', 'schedule an event', 'delete this file'), you MUST NOT call the tool for that action directly. Instead, you MUST use the `journal-add_action_item` tool. The `content` for this tool should be a clear description of the user's request (e.g., `content='Send an email to my boss about the report'`). After calling this tool, inform the user that you have noted their request and it will be processed.\n"
        f"5. **Memory Usage:** ALWAYS use `supermemory-search` first to check for existing context. If you learn a new, permanent fact about the user, use `supermemory-addToSupermemory` to save it.\n"
        f"6. **Final Answer Format:** When you have a complete, final answer for the user that is not a tool call, you MUST wrap it in `<answer>` tags. For example: `<answer>The weather in London is 15°C and cloudy.</answer>`.\n\n"
        f"**Your Persona:**\n"
        f"- Your responses should be **{verbosity}**.\n"
        f"- Your tone should be **{humor_level}**.\n"
        f"- {emoji_usage}\n\n"
        f"{disconnected_tools_prompt_section}"
        f"**User Context (for your reference):**\n"
        f"-   **User's Name:** {username}\n"
        f"-   **User's Location:** {location}\n"
        f"-   **Current Time:** {current_user_time}\n\n"
        f"Your primary directive is to be as personalized and helpful as possible by actively using your memory and tools. Do not ask questions you should already know the answer to; search your memory instead."
    )

    def worker():
        try:
            qwen_assistant = get_qwen_assistant(system_message=system_prompt, function_list=tools)
            qwen_formatted_history = [{"role": msg["role"], "content": msg["content"]} for msg in messages]
            for new_history_step in qwen_assistant.run(messages=qwen_formatted_history):
                loop.call_soon_threadsafe(queue.put_nowait, new_history_step)
        except Exception as e:
            logger.error(f"Error in chat worker thread for user {user_id}: {e}", exc_info=True)
            loop.call_soon_threadsafe(queue.put_nowait, {"_error": str(e)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    try:
        last_yielded_content_str = ""
        while True:
            current_history = await queue.get()
            if current_history is None:
                break
            if isinstance(current_history, dict) and "_error" in current_history:
                raise Exception(f"Qwen Agent worker failed: {current_history['_error']}")
            if not isinstance(current_history, list):
                continue
            
            assistant_turn_start_index = next((i + 1 for i in range(len(current_history) - 1, -1, -1) if current_history[i].get('role') == 'user'), 0)
            assistant_messages = current_history[assistant_turn_start_index:]
            current_turn_str = "".join(msg_to_str(m) for m in assistant_messages)
            if len(current_turn_str) > len(last_yielded_content_str):
                new_chunk = current_turn_str[len(last_yielded_content_str):]
                yield {"type": "assistantStream", "token": new_chunk, "done": False, "messageId": assistant_message_id}
                last_yielded_content_str = current_turn_str
    except asyncio.CancelledError:
        stream_interrupted = True
        raise
    except Exception as e:
        logger.error(f"Error during main chat agent run for user {user_id}: {e}", exc_info=True)
        yield {"type": "error", "message": "An unexpected error occurred in the chat agent."}
    finally:
        yield {"type": "assistantStream", "token": "", "done": True, "messageId": assistant_message_id}

def msg_to_str(msg: Dict[str, Any]) -> str:
    if msg.get('role') == 'assistant' and msg.get('function_call'):
        args_str = msg['function_call'].get('arguments', '')
        try: args_pretty = json.dumps(json.loads(args_str), indent=2)
        except: args_pretty = args_str
        return f"<tool_code name=\"{msg['function_call'].get('name')}\">\n{args_pretty}\n</tool_code>\n"
    elif msg.get('role') == 'function':
        content = msg.get('content', '')
        try: content_pretty = json.dumps(json.loads(content), indent=2)
        except: content_pretty = content
        return f"<tool_result tool_name=\"{msg.get('name')}\">\n{content_pretty}\n</tool_result>\n"
    elif msg.get('role') == 'assistant' and msg.get('content'):
        return msg.get('content', '')
    return ''