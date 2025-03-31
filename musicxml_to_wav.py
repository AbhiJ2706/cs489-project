#!/usr/bin/env python3
"""
Convert MusicXML to WAV using music21 and FluidSynth
"""

import os
import sys
import argparse
from music21 import converter, midi
import subprocess
import tempfile

def musicxml_to_wav(input_xml, output_wav, soundfont_path="FluidR3_GM.sf2"):
    """
    Convert MusicXML file to WAV audio file.
    
    Args:
        input_xml (str): Path to input MusicXML file
        output_wav (str): Path to output WAV file
        soundfont_path (str): Path to SoundFont file for synthesis
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        print(f"Loading MusicXML file: {input_xml}")
        # Parse the MusicXML file
        score = converter.parse(input_xml)
        
        # Create a temporary MIDI file
        with tempfile.NamedTemporaryFile(suffix='.mid', delete=False) as temp_midi:
            temp_midi_path = temp_midi.name
        
        print(f"Converting to MIDI...")
        # Convert to MIDI
        midi_file = score.write('midi', fp=temp_midi_path)
        
        print(f"Synthesizing audio with FluidSynth...")
        # Use FluidSynth to convert MIDI to WAV with higher gain
        cmd = [
            'fluidsynth',
            '-ni',
            '-g', '5',  # increased gain from 1 to 5
            '-F', output_wav,  # output file
            soundfont_path,  # soundfont
            temp_midi_path  # input MIDI file
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Clean up temporary MIDI file
        os.unlink(temp_midi_path)
        
        print(f"WAV file saved as: {output_wav}")
        return True
    
    except Exception as e:
        print(f"Error converting MusicXML to WAV: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Convert MusicXML to WAV')
    parser.add_argument('input_xml', help='Input MusicXML file')
    parser.add_argument('output_wav', help='Output WAV file')
    parser.add_argument('--soundfont', default='FluidR3_GM.sf2', help='Path to SoundFont file')
    parser.add_argument('--gain', type=float, default=5.0, help='Gain level for audio synthesis (default: 5.0)')
    
    args = parser.parse_args()
    
    success = musicxml_to_wav(args.input_xml, args.output_wav, args.soundfont)
    
    if success:
        print("Conversion completed successfully.")
    else:
        print("Conversion failed.")
        sys.exit(1)

if __name__ == '__main__':
    main()