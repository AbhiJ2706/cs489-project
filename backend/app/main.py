"""
FastAPI backend for WAV to Sheet Music conversion.
"""

import music21
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import re

# Import routers
from app.routers.home import router as home_router
from app.routers.conversion.audio import router as audio_conversion_router
from app.routers.conversion.online import router as online_conversion_router
from app.routers.files.operations import router as files_router
from app.routers.audio.operations import router as audio_router

# Configure music21 to use a different PDF backend if MuseScore is not available
try:
    # Try to use MuseScore
    music21.environment.set("musicxmlPath", "musescore")
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

def run_server():
    """Run the FastAPI server."""
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    run_server()