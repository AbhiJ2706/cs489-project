"""
FastAPI backend for WAV to Sheet Music conversion.
"""

import music21
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import re
import asyncio
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import routers
from app.routers.home import router as home_router
from app.routers.conversion.audio import router as audio_conversion_router
from app.routers.conversion.online import router as online_conversion_router
from app.routers.files.operations import router as files_router
from app.routers.audio.operations import router as audio_router
from app.routers.auth import router as auth_router
from app.routers.scores import router as scores_router

# Import utils
from app.utils import setup_musescore_path
from app.utils.cleanup import cleanup_old_files

# Set up logger
logger = logging.getLogger(__name__)

# Setup MuseScore path
setup_musescore_path()

# Add PDF path setting
try:
    music21.environment.set("pdfPath", "musescore")
except:
    # Fallback to Lilypond if available
    try:
        music21.environment.set("lilypondPath", "lilypond")
    except:
        # If neither is available, we'll handle this in the conversion function
        pass

# Create FastAPI app
app = FastAPI(title="DaScore API")

# Background task for cleaning up old files
background_tasks = set()

@app.on_event("startup")
async def startup_event():
    """
    Run startup tasks for the application.
    """
    # Start the periodic cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    background_tasks.add(cleanup_task)
    cleanup_task.add_done_callback(background_tasks.discard)
    logger.info("Started background cleanup task")

@app.on_event("shutdown")
async def shutdown_event():
    """
    Run shutdown tasks for the application.
    """
    # Cancel all background tasks
    for task in background_tasks:
        task.cancel()
    logger.info("Cancelled background cleanup tasks")

async def periodic_cleanup():
    """
    Periodically clean up old files.
    """
    while True:
        try:
            # Clean up files older than 24 hours
            await cleanup_old_files(max_age_hours=24)
        except Exception as e:
            logger.error(f"Error during periodic cleanup: {e}")
        
        # Sleep for 1 hour before next cleanup
        await asyncio.sleep(3600)

# Get CORS origins from environment or use defaults
cors_origins_str = os.getenv("CORS_ALLOW_ORIGINS", "https://www.visualize.music,http://localhost:3000,*")
cors_origins = cors_origins_str.split(",")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.ideaflow\.app$",  # Allows any subdomain of ideaflow.app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(home_router)
app.include_router(audio_conversion_router)
app.include_router(online_conversion_router)
app.include_router(files_router)
app.include_router(audio_router)
app.include_router(auth_router)
app.include_router(scores_router)

def run_server():
    """Run the FastAPI server."""
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    run_server()