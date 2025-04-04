"""
Utility functions for the application, including environment and path setup.
"""

import os
import logging

# Get logger
from utils.logger import get_logger
logger = get_logger(__name__)

def setup_musescore_path():
    """
    Set up the MuseScore path for music21 environment.
    Checks for Docker path first, falls back to macOS path.
    Returns the path that was set.
    """
    from music21 import environment
    
    # Docker path (Linux)
    docker_path = '/usr/local/bin/mscore'
    # macOS path (local development)
    macos_path = '/Applications/MuseScore 4.app/Contents/MacOS/mscore'
    
    if os.path.exists(docker_path):
        mscore_path = docker_path
        logger.info(f"Using Docker MuseScore path: {mscore_path}")
    else:
        mscore_path = macos_path
        logger.info(f"Using macOS MuseScore path: {mscore_path}")
    
    # Try to set the path safely
    try:
        # If we're in Docker and the file doesn't exist yet, use dict access
        if mscore_path == docker_path and not os.path.exists(docker_path):
            environment.UserSettings()['musicxmlPath'] = mscore_path
            logger.info(f"Set musicxmlPath using dictionary access: {mscore_path}")
        else:
            environment.set('musicxmlPath', mscore_path)
            logger.info(f"Set musicxmlPath using standard method: {mscore_path}")
    except Exception as e:
        logger.warning(f"Failed to set musicxmlPath: {str(e)}")
        logger.warning(f"Attempting alternate setting method...")
        try:
            environment.UserSettings()['musicxmlPath'] = mscore_path
            logger.info(f"Successfully set musicxmlPath using alternate method: {mscore_path}")
        except Exception as e2:
            logger.error(f"All attempts to set musicxmlPath failed: {str(e2)}")
    
    return mscore_path

def get_youtube_cookies_path():
    """
    Get the path for YouTube cookies file.
    Checks for Docker path first, falls back to local backend directory.
    Returns the path to the cookies file.
    """
    # Docker path
    docker_path = '/app/backend/youtube-cookies.txt'
    
    # Local development path - relative to backend directory
    import pathlib
    current_dir = pathlib.Path(__file__).parent.parent  # app/utils.py -> app -> backend
    local_path = current_dir / 'youtube-cookies.txt'
    
    if os.path.exists(docker_path):
        cookies_path = docker_path
        logger.info(f"Using Docker YouTube cookies path: {cookies_path}")
    elif os.path.exists(local_path):
        cookies_path = str(local_path)
        logger.info(f"Using local YouTube cookies path: {cookies_path}")
    else:
        # If no cookies file exists, log a warning and return the local path anyway
        # (it will be created or the download will fail with an appropriate error)
        cookies_path = str(local_path)
        logger.warning(f"YouTube cookies file not found at {docker_path} or {local_path}")
        logger.warning("YouTube downloads may fail due to bot protection without a cookies file")
    
    return cookies_path
