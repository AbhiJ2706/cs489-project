#!/usr/bin/env python3
"""
Check if required dependencies for PDF generation are installed.
"""

import os
import sys
import subprocess
import shutil
import platform

def check_musescore():
    """Check if MuseScore is installed and available in the PATH."""
    musescore_names = ["mscore", "musescore", "MuseScore", "MuseScore3", "MuseScore4"]
    
    for name in musescore_names:
        if shutil.which(name):
            print(f"✅ MuseScore found as '{name}'")
            return True
    
    return False

def check_lilypond():
    """Check if LilyPond is installed and available in the PATH."""
    if shutil.which("lilypond"):
        print("✅ LilyPond found")
        return True
    
    return False

def get_installation_instructions():
    """Get platform-specific installation instructions."""
    system = platform.system()
    
    if system == "Windows":
        return """
Installation Instructions for Windows:
-------------------------------------
1. MuseScore (recommended):
   - Download from https://musescore.org/en/download
   - Run the installer and follow the instructions
   - Make sure to add MuseScore to your PATH during installation

2. LilyPond (alternative):
   - Download from https://lilypond.org/download.html
   - Run the installer and follow the instructions
   - Add the LilyPond bin directory to your PATH
"""
    elif system == "Darwin":  # macOS
        return """
Installation Instructions for macOS:
-----------------------------------
1. MuseScore (recommended):
   - Download from https://musescore.org/en/download
   - Install the application
   - Create a symbolic link to make it available in the terminal:
     sudo ln -s /Applications/MuseScore*.app/Contents/MacOS/mscore /usr/local/bin/mscore

2. LilyPond (alternative):
   - Install with Homebrew: brew install lilypond
   - Or download from https://lilypond.org/download.html
"""
    else:  # Linux
        return """
Installation Instructions for Linux:
----------------------------------
1. MuseScore (recommended):
   - Install using your package manager:
     - Ubuntu/Debian: sudo apt-get install musescore
     - Fedora: sudo dnf install musescore
     - Arch Linux: sudo pacman -S musescore

2. LilyPond (alternative):
   - Install using your package manager:
     - Ubuntu/Debian: sudo apt-get install lilypond
     - Fedora: sudo dnf install lilypond
     - Arch Linux: sudo pacman -S lilypond
"""

def main():
    """Main function to check dependencies and provide instructions."""
    print("Checking dependencies for PDF generation...")
    
    musescore_installed = check_musescore()
    lilypond_installed = check_lilypond()
    
    if not musescore_installed and not lilypond_installed:
        print("\n❌ Neither MuseScore nor LilyPond is installed.")
        print("\nThe application will still work, but PDF generation will be disabled.")
        print("MusicXML files will still be generated and can be opened in any music notation software.")
        
        print("\nTo enable PDF generation, please install one of the following:")
        print(get_installation_instructions())
    elif not musescore_installed:
        print("\n⚠️ MuseScore is not installed, but LilyPond is available.")
        print("PDF generation will use LilyPond, which may produce different results than MuseScore.")
    elif not lilypond_installed:
        print("\n⚠️ LilyPond is not installed, but MuseScore is available.")
        print("PDF generation will use MuseScore.")
    else:
        print("\n✅ Both MuseScore and LilyPond are installed.")
        print("PDF generation will use MuseScore by default.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 