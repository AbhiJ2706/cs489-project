"""
Configuration settings for the DaScore API.
"""

import tempfile
from pathlib import Path

# Create temporary directory for storing files
TEMP_DIR = Path(tempfile.gettempdir()) / "audio_converter"
TEMP_DIR.mkdir(exist_ok=True)

# Get the absolute path to the project root directory
PROJECT_ROOT = Path(__file__).parent.absolute()
SOUNDFONT_PATH = PROJECT_ROOT / "FluidR3_GM.sf2"

# Output debugging information about soundfont
print(f"Soundfont path: {SOUNDFONT_PATH}")
print(f"Soundfont exists: {SOUNDFONT_PATH.exists()}")
