import argparse
import logging
import os
import traceback
import warnings

import librosa
import librosa.display

from music21 import environment

from create_sheet_music import generate_sheet_music, midi_to_musicxml
from load_audio import load_audio_with_fallback
from process_audio import detect_notes_and_chords, preprocess_audio
from visualize import visualize_audio


environment.set(
    'musicxmlPath', '/Applications/MuseScore 4.app/Contents/MacOS/mscore')

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if os.path.exists('/usr/local/bin/mscore'):
    # Docker path (Linux)
    mscore_path = '/usr/local/bin/mscore'
    environment.set('musicxmlPath', mscore_path)
    logger.info(f"Using Docker MuseScore path: {mscore_path}")
    # Verify if executable
    is_executable = os.access(mscore_path, os.X_OK)
    logger.info(f"Is mscore executable: {is_executable}")
    # Try to run mscore --version to verify installation
    try:
        import subprocess
        result = subprocess.run([mscore_path, '--version'], capture_output=True, text=True)
        logger.info(f"MuseScore version check: {result.stdout.strip() if result.returncode == 0 else f'Failed with return code {result.returncode}: {result.stderr}'}")
    except Exception as e:
        logger.error(f"Error checking MuseScore version: {str(e)}")
else:
    # macOS path (local development)
    mscore_path = '/Applications/MuseScore 4.app/Contents/MacOS/mscore'
    environment.set('musicxmlPath', mscore_path)
    logger.info(f"Using macOS MuseScore path: {mscore_path}")
    # Verify if the path exists
    path_exists = os.path.exists(mscore_path)
    logger.info(f"MuseScore path exists: {path_exists}")

warnings.filterwarnings("ignore", message="PySoundFile failed.*")
warnings.filterwarnings("ignore", category=FutureWarning)


def wav_to_sheet_music(input_wav, output_xml, title=None, visualize=False, output_pdf=None):
    print(f"Loading audio file: {input_wav}")
    try:
        audio_data, sample_rate = load_audio_with_fallback(input_wav)
    except Exception as e:
        print(f"Error loading audio: {e}")
        print(f"Error details:\n{traceback.format_exc()}")
        return False

    print(f"Sample rate: {sample_rate}")

    print("Detecting tempo...")
    tempo_value, _ = librosa.beat.beat_track(y=audio_data, sr=sample_rate)
    print(f"""
          Detected tempo: {tempo_value} BPM, 
          Length of a bar: {1 / (tempo_value[0] / 4) * 60}
          Length of a quarter note: {1 / (tempo_value[0] / 4) * 15}
    """)

    if title is None:
        title = os.path.splitext(os.path.basename(input_wav))[0]

    print("Preprocessing audio...")
    preprocessed_audio = preprocess_audio(audio_data, sample_rate)

    print("Detecting notes...")
    midi_data = detect_notes_and_chords(preprocessed_audio, sample_rate)

    print("Converting to MusicXML...")
    score, treble_note_list, bass_note_list = midi_to_musicxml(
        midi_data, title=title, tp=tempo_value)

    print("Generating sheet music...")
    success = generate_sheet_music(
        score, output_xml, output_pdf, treble_note_list, bass_note_list)

    if visualize:
        print("Generating audio visualization...")
        output_image = os.path.splitext(
            output_xml)[0] + "_visualization.png"
        visualize_audio(preprocessed_audio, sample_rate, output_image)

    if success:
        print("Conversion completed successfully.")
    else:
        print("Conversion completed with errors.")

    return success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert WAV audio to sheet music")
    parser.add_argument("input_wav", help="Path to the input WAV file")
    parser.add_argument(
        "output_xml", help="Path to save the output MusicXML file")
    parser.add_argument("--title", help="Title for the sheet music")
    parser.add_argument("--visualize", action="store_true",
                        help="Visualize the audio")
    parser.add_argument("--pdf", dest="output_pdf",
                        help="Path to save the output PDF file")

    args = parser.parse_args()

    if not os.path.isdir(f"out/{args.title.replace(' ', '_')}"):
        os.mkdir(f"out/{args.title.replace(' ', '_')}")

    wav_to_sheet_music(
        args.input_wav,
        f"out/{args.title.replace(' ', '_')}/{args.output_xml}",
        title=args.title,
        visualize=args.visualize,
        output_pdf=f"out/{args.title.replace(' ', '_')}/{args.output_pdf}"
    )
