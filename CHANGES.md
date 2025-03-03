# Changes: LilyPond to MusicXML Conversion

This document outlines the changes made to convert the WAV to Sheet Music converter from using LilyPond to using MusicXML.

## Key Changes

1. **Core Functionality**:
   - Replaced `midi_to_lilypond()` function with `midi_to_musicxml()` function
   - Updated `generate_sheet_music()` to work with MusicXML instead of LilyPond
   - Added optional PDF export using MuseScore instead of LilyPond

2. **Dependencies**:
   - Removed LilyPond dependency
   - Added music21 library dependency for MusicXML handling

3. **File Outputs**:
   - Changed primary output from `.ly` (LilyPond) files to `.musicxml` files
   - Made PDF generation optional (requires MuseScore)
   - Maintained MIDI file output for compatibility

4. **Command Line Interface**:
   - Updated command line arguments to accept MusicXML output path
   - Added optional `--pdf` argument for PDF generation

5. **Documentation**:
   - Updated README.md with MusicXML information
   - Added information about compatible notation software
   - Updated installation instructions to mention MuseScore instead of LilyPond

6. **Helper Scripts**:
   - Updated shell scripts to check for MuseScore instead of LilyPond
   - Updated example scripts to work with MusicXML
   - Added new `musicxml_example.py` script to demonstrate MusicXML manipulation

## Benefits of MusicXML

1. **Wider Compatibility**: MusicXML is supported by virtually all music notation software, including MuseScore, Finale, Sibelius, and Dorico.

2. **Richer Representation**: MusicXML can represent more musical elements than LilyPond text format, including detailed articulations, dynamics, and formatting.

3. **Easier Editing**: Users can open MusicXML files directly in their preferred notation software for further editing.

4. **Standard Format**: MusicXML is an industry standard for exchanging musical scores between different software.

5. **Programmatic Manipulation**: Using the music21 library, MusicXML files can be easily manipulated programmatically (transposition, analysis, etc.).

## Usage Examples

### Basic Usage

```bash
python -m src.cs489_project.wav_to_sheet_music input.wav output.musicxml
```

### With PDF Export

```bash
python -m src.cs489_project.wav_to_sheet_music input.wav output.musicxml --pdf output.pdf
```

### With Visualization and Custom Title

```bash
python -m src.cs489_project.wav_to_sheet_music input.wav output.musicxml --title "My Song" --visualize
```

### Programmatic Usage

```python
from src.cs489_project.wav_to_sheet_music import wav_to_sheet_music

wav_to_sheet_music(
    "input.wav", 
    "output.musicxml", 
    title="My Song", 
    visualize=True,
    output_pdf="output.pdf"
)
``` 