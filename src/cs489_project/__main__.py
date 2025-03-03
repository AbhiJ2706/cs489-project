#!/usr/bin/env python3
"""
Main module script for the WAV to Sheet Music converter.
This allows running the converter as a Python module:
    python -m src.cs489_project input.wav output.pdf
"""

import sys
from .wav_to_sheet_music import main

if __name__ == "__main__":
    sys.exit(main()) 