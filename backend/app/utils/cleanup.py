"""
Cleanup utilities for managing temporary files.
"""

import os
import shutil
import logging
from datetime import datetime, timedelta
from pathlib import Path

from app.config import TEMP_DIR

# Set up logger
logger = logging.getLogger(__name__)

def cleanup_temp_directory(temp_dir: Path):
    """
    Clean up a specific temporary directory.
    
    Args:
        temp_dir: Path to the temporary directory to clean up
    """
    try:
        if temp_dir.exists():
            logger.info(f"Cleaning up temporary directory: {temp_dir}")
            shutil.rmtree(temp_dir)
            return True
    except Exception as e:
        logger.error(f"Failed to clean up temporary directory {temp_dir}: {e}")
        return False


def cleanup_file_by_id(file_id: str, keep_pdf=True, keep_musicxml=True):
    """
    Clean up all files associated with a specific file ID.
    
    Args:
        file_id: The unique identifier for the file set
        keep_pdf: Whether to keep the PDF file
        keep_musicxml: Whether to keep the MusicXML file
    """
    try:
        # Clean up the subdirectory first
        temp_subdir = TEMP_DIR / file_id
        cleanup_temp_directory(temp_subdir)
        
        # List of possible extensions for files to clean up
        extensions = [".wav", "_synthesized.wav", ".musicmid"]
        
        # Only clean up these files if specified
        if not keep_pdf:
            extensions.append(".pdf")
        if not keep_musicxml:
            extensions.append(".musicxml")
        
        # Clean up individual files
        for extension in extensions:
            file_path = TEMP_DIR / f"{file_id}{extension}"
            if file_path.exists():
                logger.info(f"Removing temporary file: {file_path}")
                file_path.unlink()
        
        return True
    except Exception as e:
        logger.error(f"Failed to clean up files for ID {file_id}: {e}")
        return False


async def cleanup_old_files(max_age_hours=24):
    """
    Clean up files in the temporary directory that are older than the specified age.
    
    Args:
        max_age_hours: Maximum age of files in hours before they are cleaned up
    """
    try:
        logger.info(f"Running cleanup of files older than {max_age_hours} hours in {TEMP_DIR}")
        now = datetime.now()
        cutoff_time = now - timedelta(hours=max_age_hours)
        
        # Process directories first (these are the temp dirs for each conversion)
        for item in TEMP_DIR.iterdir():
            try:
                # Skip if it doesn't exist anymore (could have been deleted by another process)
                if not item.exists():
                    continue
                
                # Get the modification time
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                
                # Skip if it's newer than our cutoff
                if mtime > cutoff_time:
                    continue
                
                # Clean up old items
                if item.is_dir():
                    logger.info(f"Removing old directory: {item} (last modified: {mtime})")
                    shutil.rmtree(item)
                else:
                    logger.info(f"Removing old file: {item} (last modified: {mtime})")
                    item.unlink()
            except Exception as e:
                logger.error(f"Error cleaning up {item}: {e}")
        
        logger.info("Cleanup completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during cleanup of old files: {e}")
        return False
