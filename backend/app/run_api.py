#!/usr/bin/env python3
"""
Script to run the FastAPI server for the DaScore.
"""

from .main import run_server
from .check_dependencies import main as check_dependencies

if __name__ == "__main__":
    # Check if MuseScore or LilyPond is installed
    check_dependencies()
    
    # Run the FastAPI server
    print("\nStarting the API server...")
    run_server() 