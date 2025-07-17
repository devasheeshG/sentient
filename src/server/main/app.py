import time
import datetime
from datetime import timezone
START_TIME = time.time()
print(f"[{datetime.datetime.now()}] [STARTUP] Main Server application script execution started.")

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from main.config import APP_SERVER_PORT
from main.dependencies import mongo_manager
from main.auth.routes import router as auth_router
from main.chat.routes import router as chat_router
from main.notifications.routes import router as notifications_router
from main.integrations.routes import router as integrations_router
from main.misc.routes import router as misc_router
from main.agents.routes import router as agents_router
from main.settings.routes import router as settings_router # Import the new router
from main.testing.routes import router as testing_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__) 

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    print(f"[{datetime.datetime.now(timezone.utc).isoformat()}] [LIFESPAN] App startup...")
    await mongo_manager.initialize_db()
    print(f"[{datetime.datetime.now(timezone.utc).isoformat()}] [LIFESPAN] App startup complete.")
    yield 
    print(f"[{datetime.datetime.now(timezone.utc).isoformat()}] [LIFESPAN] App shutdown sequence initiated...")    
    if mongo_manager and mongo_manager.client:
        mongo_manager.client.close()
    print(f"[{datetime.datetime.now(timezone.utc).isoformat()}] [LIFESPAN] App shutdown complete.")

app = FastAPI(title="Sentient Main Server", version="2.2.0", docs_url="/docs", redoc_url="/redoc", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], # More permissive for development
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(integrations_router)
app.include_router(misc_router)
app.include_router(agents_router)
app.include_router(settings_router) # Add the new router
app.include_router(testing_router)

@app.get("/", tags=["General"])
async def root():
    return {"message": "Sentient Main Server Operational (Qwen Agent Integrated)."}

@app.get("/health", tags=["General"])
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": "connected" if mongo_manager.client else "disconnected",
            "llm": "qwen_agent_on_demand"
        }
    }

END_TIME = time.time()
print(f"[{datetime.datetime.now()}] [APP_PY_LOADED] Main Server app.py loaded in {END_TIME - START_TIME:.2f} seconds.")

if __name__ == "__main__":
    import uvicorn
    log_config = uvicorn.config.LOGGING_CONFIG.copy()
    log_config["formatters"]["access"]["fmt"] = '%(asctime)s %(levelname)s %(client_addr)s - "[MAIN_SERVER_ACCESS] %(request_line)s" %(status_code)s'
    log_config["formatters"]["default"]["fmt"] = '%(asctime)s %(levelname)s [%(name)s] [MAIN_SERVER_DEFAULT] %(message)s'
    uvicorn.run("main.app:app", host="0.0.0.0", port=APP_SERVER_PORT, lifespan="on", reload=False, workers=1, log_config=log_config)