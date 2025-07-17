import os
from dotenv import load_dotenv
import datetime
import logging


# --- Environment Loading Logic ---
# This is the primary determinant of the runtime environment.
# It should be set in the runtime environment (e.g., Docker `environment` or shell `export`).
ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev-local')
logging.info(f"[{datetime.datetime.now()}] [Config] Initializing configuration for ENVIRONMENT='{ENVIRONMENT}'")

server_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ENVIRONMENT == 'dev-local':
    # Prefer .env.local, fall back to .env
    dotenv_local_path = os.path.join(server_root, '.env.local')
    dotenv_path = os.path.join(server_root, '.env')
    load_path = dotenv_local_path if os.path.exists(dotenv_local_path) else dotenv_path
    logging.info(f"[{datetime.datetime.now()}] [Config] Loading .env file for 'dev-local' mode from: {load_path}")
    if os.path.exists(load_path):
        load_dotenv(dotenv_path=load_path)
elif ENVIRONMENT == 'selfhost':
    # Self-hosting with Docker. docker-compose injects variables from src/.env for substitution.
    # python-dotenv loads .env.selfhost to get the rest of the config.
    dotenv_path = os.path.join(server_root, '.env.selfhost')
    logging.info(f"[{datetime.datetime.now()}] [Config] Loading .env file for 'selfhost' mode from: {dotenv_path}")
    load_dotenv(dotenv_path=dotenv_path)
else:
    # For 'dev-cloud', 'stag', 'prod', variables are loaded by start.sh or the cloud environment.
    logging.info(f"[{datetime.datetime.now()}] [Config] Skipping python-dotenv loading for '{ENVIRONMENT}' mode. Expecting variables from shell environment.")

APP_SERVER_PORT = int(os.getenv("APP_SERVER_PORT", "5000"))

# Auth0 Configuration
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE") 
AUTH0_SCOPE = os.getenv("AUTH0_SCOPE")
ALGORITHMS = ["RS256"]
SELF_HOST_AUTH_SECRET = os.getenv("SELF_HOST_AUTH_SECRET")
# For Management API
AUTH0_MANAGEMENT_CLIENT_ID = os.getenv("AUTH0_MANAGEMENT_CLIENT_ID")
AUTH0_MANAGEMENT_CLIENT_SECRET = os.getenv("AUTH0_MANAGEMENT_CLIENT_SECRET")

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# GitHub OAuth Configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

# Slack & Notion OAuth Configuration
SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET")
NOTION_CLIENT_ID = os.getenv("NOTION_CLIENT_ID")
NOTION_CLIENT_SECRET = os.getenv("NOTION_CLIENT_SECRET")

# News API Configuration
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "sentient_agent_db")

# AES Encryption Keys
AES_SECRET_KEY_HEX = os.getenv("AES_SECRET_KEY")
AES_IV_HEX = os.getenv("AES_IV")

AES_SECRET_KEY = None
AES_IV = None

if AES_SECRET_KEY_HEX:
    if len(AES_SECRET_KEY_HEX) == 64: # 32 bytes = 64 hex chars
        AES_SECRET_KEY = bytes.fromhex(AES_SECRET_KEY_HEX)
    else:
        print(f"[{datetime.datetime.now()}] [MainServer_Config_WARNING] AES_SECRET_KEY is invalid (must be 64 hex characters for a 256-bit key). Encryption/Decryption will fail.")
else:
    print(f"[{datetime.datetime.now()}] [MainServer_Config_WARNING] AES_SECRET_KEY is not set. Encryption/Decryption will fail.")

if AES_IV_HEX:
    if len(AES_IV_HEX) == 32: # 16 bytes = 32 hex chars
        AES_IV = bytes.fromhex(AES_IV_HEX)
    else:
        print(f"[{datetime.datetime.now()}] [MainServer_Config_WARNING] AES_IV is invalid (must be 32 hex characters for a 128-bit IV). Encryption/Decryption will fail.")
else:
    print(f"[{datetime.datetime.now()}] [MainServer_Config_WARNING] AES_IV is not set. Encryption/Decryption will fail.")

# WAHA Configuration
WAHA_URL = os.getenv("WAHA_URL", "http://localhost:3000")
WAHA_API_KEY = os.getenv("WAHA_API_KEY")

# Google API Config (mainly for token storage path if server handles auth code exchange)
_SERVER_DIR_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..")) # main -> server
GOOGLE_TOKEN_STORAGE_DIR = os.path.join(_SERVER_DIR_ROOT, "google_tokens")
os.makedirs(GOOGLE_TOKEN_STORAGE_DIR, exist_ok=True)


# Polling related constants
POLLING_INTERVALS = {
    "ACTIVE_USER_SECONDS": int(os.getenv("POLL_GMAIL_ACTIVE_USER_SECONDS", 5 * 60)),
}
SUPPORTED_POLLING_SERVICES = ["gmail", "gcalendar"] 

# Note: For "oauth" type, the client ID will be added dynamically in the /sources endpoint
INTEGRATIONS_CONFIG = {
    "github": {
        "display_name": "GitHub",
        "description": "Connect to manage repositories, issues, and more. Enables the agent to search public and private repos, list your repos, view repository details, list issues, create new issues, and read file contents.",
        "auth_type": "oauth",
        "icon": "IconBrandGithub",
        "mcp_server_config": {
            "name": "github_server",
            "url": os.getenv("GITHUB_MCP_SERVER_URL", "http://localhost:9010/sse")
        }
    },
    "gdrive": { # User-configurable OAuth
        "display_name": "Google Drive",
        "description": "Access and manage files in your Google Drive. Allows the agent to search for files by name or content and read the contents of various file types like documents and spreadsheets.",
        "auth_type": "oauth",
        "icon": "IconBrandGoogleDrive",
        "mcp_server_config": {
            "name": "gdrive_server",
            "url": os.getenv("GDRIVE_MCP_SERVER_URL", "http://localhost:9003/sse")
        }
    },
    "gcalendar": { # User-configurable OAuth
        "display_name": "Google Calendar",
        "description": "Read and manage events on your Google Calendar. Enables the agent to list upcoming events, add new events, search for specific events, update event details, and delete events.",
        "auth_type": "oauth",
        "icon": "IconCalendarEvent",
        "mcp_server_config": {
            "name": "gcal_server",
            "url": os.getenv("GCAL_MCP_SERVER_URL", "http://localhost:9002/sse")
        }
    },
    "gmail": { # User-configurable OAuth
        "display_name": "Gmail",
        "description": "Read, send, and manage emails. The agent can search your inbox, send new emails, create drafts, reply to threads, forward messages, and manage emails by deleting them or marking them as read/unread.",
        "auth_type": "oauth",
        "icon": "IconMail",
        "mcp_server_config": {
            "name": "gmail_server",
            "url": os.getenv("GMAIL_MCP_SERVER_URL", "http://localhost:9001/sse")
        }
    },
    "gdocs": {
        "display_name": "Google Docs",
        "description": "Create and manage documents in Google Docs. Allows the agent to generate new, multi-section documents with titles, headings, paragraphs, and bullet points.",
        "auth_type": "oauth",
        "icon": "IconFileText",
        "mcp_server_config": {
            "name": "gdocs_server",
            "url": os.getenv("GDOCS_MCP_SERVER_URL", "http://localhost:9004/sse")
        }
    },
    "gslides": {
        "display_name": "Google Slides",
        "description": "Create and manage presentations in Google Slides. The agent can build new slide decks with titles, content, images, and charts based on a structured outline you provide.",
        "auth_type": "oauth",
        "icon": "IconPresentation",
        "mcp_server_config": {
            "name": "gslides_server",
            "url": os.getenv("GSLIDES_MCP_SERVER_URL", "http://localhost:9014/sse")
        }
    },
    "gsheets": {
        "display_name": "Google Sheets",
        "description": "Create and manage spreadsheets in Google Sheets. The agent can help organize data by creating new spreadsheets with one or more sheets, including headers and rows.",
        "auth_type": "oauth",
        "icon": "IconTable",
        "mcp_server_config": {
            "name": "gsheets_server",
            "url": os.getenv("GSHEETS_MCP_SERVER_URL", "http://localhost:9015/sse")
        }
    },
    "gpeople": {
        "display_name": "Google People",
        "description": "Manage your contacts. The agent can search, create, update, and delete contacts in your Google account, helping you keep your address book organized.",
        "auth_type": "oauth",
        "icon": "IconUsers",
        "mcp_server_config": {
            "name": "gpeople_server",
            "url": os.getenv("GPEOPLE_MCP_SERVER_URL", "http://localhost:9019/sse")
        }
    },
    "gmaps": {
        "display_name": "Google Maps",
        "description": "Search for places and get directions. The agent can look up addresses, points of interest, and find routes for driving, walking, bicycling, or transit.",
        "auth_type": "builtin",
        "icon": "IconMapPin",
        "mcp_server_config": {
            "name": "gmaps_server",
            "url": os.getenv("GMAPS_MCP_SERVER_URL", "http://localhost:9016/sse")
        }
    },
    "gshopping": {
        "display_name": "Google Shopping",
        "description": "Search for products online. The agent can find items to purchase by searching Google Shopping and returning a list of products with titles, links, and prices.",
        "auth_type": "builtin",
        "icon": "IconShoppingCart",
        "mcp_server_config": {
            "name": "gshopping_server",
            "url": os.getenv("GSHOPPING_MCP_SERVER_URL", "http://localhost:9017/sse")
        }
    },
    "slack": { # User-configurable Manual
        "display_name": "Slack",
        "description": "Connect to your Slack workspace. Allows the agent to list channels, post messages, reply in threads, add reactions, read channel history, and get user information.",
        "auth_type": "oauth",
        "icon": "IconBrandSlack",
        "mcp_server_config": {
            "name": "slack_server",
            "url": os.getenv("SLACK_MCP_SERVER_URL", "http://localhost:9006/sse")
        }
    },
    "notion": {
        "display_name": "Notion",
        "description": "Connect to your Notion workspace. The agent can search for pages and databases, read page content, create new pages, append content to existing pages, and query databases with filters.",
        "auth_type": "oauth",
        "icon": "IconBrandNotion",
        "mcp_server_config": {
            "name": "notion_server",
            "url": os.getenv("NOTION_MCP_SERVER_URL", "http://localhost:9009/sse")
        }
    },
    "news": { # Built-in
        "display_name": "News",
        "description": "Fetches top headlines and news articles from around the world. The agent can get top headlines by country or category, or search for articles on any topic.",
        "auth_type": "builtin",
        "icon": "IconNews",
        "mcp_server_config": {
            "name": "news_server",
            "url": os.getenv("NEWS_MCP_SERVER_URL", "http://localhost:9012/sse")
        }
    },
    "internet_search": { # Built-in
        "display_name": "Internet Search",
        "description": "Allows the agent to search the web using Google Search to find real-time, factual information on any topic.",
        "auth_type": "builtin",
        "icon": "IconWorldSearch",
        "mcp_server_config": {
            "name": "google_search",
            "url": os.getenv("GOOGLE_SEARCH_MCP_SERVER_URL", "http://localhost:9005/sse")
        }
    },
    "accuweather": { # Built-in
        "display_name": "AccuWeather",
        "description": "Provides current weather conditions and daily forecasts. The agent can get the current weather for any location or a forecast for the next 1-5 days.",
        "auth_type": "builtin",
        "icon": "IconCloud", # Frontend needs to map this string to the icon component
        "mcp_server_config": {
            "name": "weather_server",
            "url": os.getenv("ACCUWEATHER_MCP_SERVER_URL", "http://localhost:9007/sse")
        }
    },
    "quickchart": { # Built-in
        "display_name": "QuickChart",
        "description": "Generates charts and data visualizations on the fly. The agent can create bar charts, line charts, pie charts, and more, then provide a URL or download the image.",
        "auth_type": "builtin",
        "icon": "IconChartPie", # Frontend needs to map this
        "mcp_server_config": {
            "name": "quickchart_server",
            "url": os.getenv("QUICKCHART_MCP_SERVER_URL", "http://localhost:9008/sse")
        }
    },
    "progress_updater": { # Built-in tool for executor
        "display_name": "Progress Updater",
        "description": "Internal tool for the system to provide real-time progress updates on long-running tasks.",
        "auth_type": "builtin",
        "icon": "IconActivity", # Will need to add this icon
        "mcp_server_config": {
            "name": "progress_updater_server",
            "url": os.getenv("PROGRESS_UPDATER_MCP_SERVER_URL", "http://localhost:9011/sse")
        }
    },
    "chat_tools": { # Built-in, for chat agent
        "display_name": "Chat Agent Tools",
        "description": "Internal tools for the main conversational agent, such as handing off complex tasks to the planning system and checking task status.",
        "auth_type": "builtin",
        "icon": "IconMessage", # Frontend can map this
        "mcp_server_config": {
            "name": "chat_tools_server",
            "url": os.getenv("CHAT_TOOLS_MCP_SERVER_URL", "http://localhost:9013/sse")
        }
    },
    "supermemory": {
        "display_name": "Long-Term Memory",
        "description": "The agent's long-term memory about the user. Use 'search' to recall facts, relationships, and preferences. Use 'addToSupermemory' to save new, permanent information about the user. This is critical for personalization.",
        "auth_type": "builtin",
        "icon": "IconBrain",
        "mcp_server_config": {
            "name": "supermemory",
            # URL is constructed dynamically based on user's supermemory_user_id
            "url": None
        }
    }
}

# LLM Endpoint Configuration
# --- OpenAI API Standard Configuration ---
# This can point to OpenAI, Ollama, Groq, or any other compatible service.
OPENAI_API_BASE_URL = os.getenv("OPENAI_API_BASE_URL", "http://localhost:11434")
OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "qwen3:4b")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "ollama") # Default key for Ollama

# MCP Server URLs
PROGRESS_UPDATER_MCP_SERVER_URL=os.getenv("PROGRESS_UPDATER_MCP_SERVER_URL", "http://localhost:9011/sse")
CHAT_TOOLS_MCP_SERVER_URL=os.getenv("CHAT_TOOLS_MCP_SERVER_URL", "http://localhost:9013/sse") # For agent action handoff
SUPERMEMORY_MCP_BASE_URL = os.getenv("SUPERMEMORY_MCP_BASE_URL", "https://mcp.supermemory.ai/")
SUPERMEMORY_MCP_ENDPOINT_SUFFIX = os.getenv("SUPERMEMORY_MCP_ENDPOINT_SUFFIX", "/sse")

print(f"[{datetime.datetime.now()}] [MainServer_Config] Configuration loaded. AUTH0_DOMAIN: {'SET' if AUTH0_DOMAIN else 'NOT SET'}")
print(f"[{datetime.datetime.now()}] [MainServer_Config] LLM Endpoint: {OPENAI_API_BASE_URL}")
print(f"[{datetime.datetime.now()}] [MainServer_Config] LLM Model: {OPENAI_MODEL_NAME}")
