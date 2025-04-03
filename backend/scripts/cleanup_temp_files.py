#!/usr/bin/env python
"""
Standalone script to clean up temporary files.
Run this script manually to immediately free up disk space.

Usage:
  python cleanup_temp_files.py [--age HOURS] [--force]

Options:
  --age HOURS    Age of files to delete in hours (default: 6)
  --force        Delete all temporary files regardless of age
  --dry-run      Show what would be deleted without actually deleting
"""

import os
import sys
import shutil
import argparse
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import TEMP_DIR
from app.utils.cleanup import cleanup_old_files

def sizeof_fmt(num, suffix="B"):
    """Format file size in a human-readable format"""
    for unit in ["", "K", "M", "G", "T", "P", "E", "Z"]:
        if abs(num) < 1024.0:
            return f"{num:.1f} {unit}{suffix}"
        num /= 1024.0
    return f"{num:.1f} Yi{suffix}"

def get_dir_size(path):
    """Get the size of a directory and its contents"""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.exists(fp):
                total_size += os.path.getsize(fp)
    return total_size

async def manual_cleanup(max_age_hours=6, force=False, dry_run=False):
    """
    Clean up files in the temporary directory that are older than the specified age.
    
    Args:
        max_age_hours: Maximum age of files in hours before they are cleaned up
        force: Delete all files regardless of age
        dry_run: Show what would be deleted without actually deleting
    """
    print(f"Temporary directory: {TEMP_DIR}")
    
    # Get initial size
    initial_size = get_dir_size(TEMP_DIR)
    print(f"Initial size: {sizeof_fmt(initial_size)}")
    
    if force:
        print("Force mode: Removing ALL temporary files and directories")
        if not dry_run:
            # Delete everything in the temp dir except for the directory itself
            for item in TEMP_DIR.iterdir():
                try:
                    if item.is_dir():
                        shutil.rmtree(item)
                        print(f"Removed directory: {item}")
                    else:
                        item.unlink()
                        print(f"Removed file: {item}")
                except Exception as e:
                    print(f"Error cleaning up {item}: {e}")
    else:
        print(f"Removing files older than {max_age_hours} hours")
        now = datetime.now()
        cutoff_time = now - timedelta(hours=max_age_hours)
        
        # Process all items
        for item in TEMP_DIR.iterdir():
            try:
                # Skip if it doesn't exist anymore
                if not item.exists():
                    continue
                
                # Get the modification time
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                
                # Skip if it's newer than our cutoff
                if mtime > cutoff_time:
                    continue
                
                # Print info about what we're deleting
                if item.is_dir():
                    dir_size = get_dir_size(item)
                    print(f"{'Would remove' if dry_run else 'Removing'} directory: {item} ({sizeof_fmt(dir_size)}, last modified: {mtime})")
                    if not dry_run:
                        shutil.rmtree(item)
                else:
                    file_size = item.stat().st_size
                    print(f"{'Would remove' if dry_run else 'Removing'} file: {item} ({sizeof_fmt(file_size)}, last modified: {mtime})")
                    if not dry_run:
                        item.unlink()
            except Exception as e:
                print(f"Error processing {item}: {e}")
    
    # Get final size if not in dry run mode
    if not dry_run:
        final_size = get_dir_size(TEMP_DIR)
        print(f"Final size: {sizeof_fmt(final_size)}")
        print(f"Freed up: {sizeof_fmt(initial_size - final_size)}")
    else:
        print("Dry run completed. No files were actually deleted.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean up temporary files")
    parser.add_argument("--age", type=int, default=6, help="Age of files to delete in hours (default: 6)")
    parser.add_argument("--force", action="store_true", help="Delete all temporary files regardless of age")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without actually deleting")
    
    args = parser.parse_args()
    
    # Run the cleanup
    asyncio.run(manual_cleanup(args.age, args.force, args.dry_run))
