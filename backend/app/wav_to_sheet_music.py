import argparse
import logging
import os
import traceback
import warnings

import librosa
import librosa.display

from .utils import setup_musescore_path
from .create_sheet_music import generate_sheet_music, midi_to_musicxml
from .load_audio import load_audio_with_fallback
from .process_audio import detect_notes_and_chords, preprocess_audio
from .visualize import visualize_audio

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MuseScore path
setup_musescore_path()

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
    score = midi_to_musicxml(
        midi_data, title=title, tp=tempo_value)

    print("Generating sheet music...")
    success = generate_sheet_music(score, output_xml, output_pdf)

    if visualize:
        print("Generating audio visualization...")
        output_image = os.path.splitext(
            output_xml)[0] + "_visualization.png"
        visualize_audio(preprocessed_audio, sample_rate, output_image)

    if success:
        print("Conversion completed successfully.")
    else:
        print("Conversion completed with errors.")

    return True


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
