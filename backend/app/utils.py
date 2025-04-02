"""
Utility functions for the application, including environment and path setup.
"""

import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
