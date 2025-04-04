import argparse
import logging
import os
import shutil
import subprocess
import traceback
import warnings

import librosa
import librosa.display

from utils import setup_musescore_path
from create_sheet_music import generate_sheet_music, midi_to_musicxml
from load_audio import load_audio_with_fallback
from process_audio import detect_notes_and_chords, preprocess_audio
from visualize import visualize_audio

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize MuseScore path
setup_musescore_path()

warnings.filterwarnings("ignore", message="PySoundFile failed.*")
warnings.filterwarnings("ignore", category=FutureWarning)


def stem_file(input):
    subprocess.run(
        ["python", "-m", "demucs", input],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    return f"separated/htdemucs/{input[:input.index('.wav')]}/other.wav"


def wav_to_sheet_music(input_wav, output_xml, title=None, visualize=False, stem=False, output_pdf=None, messy=False, visualize_only=False, composer="Dascore"):
    logger.info(f"Processing audio file: {input_wav}")
    try:
        if stem:
            logger.info("Applying audio source separation...")
            new_filepath = stem_file(input_wav)
            audio_data, sample_rate = load_audio_with_fallback(new_filepath)
        else:
            audio_data, sample_rate = load_audio_with_fallback(input_wav)
    except Exception as e:
        logger.error(f"Error loading audio: {e}")
        logger.debug(f"Error details:\n{traceback.format_exc()}")
        return False

    logger.info(f"Audio loaded with sample rate: {sample_rate} Hz")

    logger.info("Detecting tempo...")
    tempo_value, _ = librosa.beat.beat_track(y=audio_data, sr=sample_rate)
    logger.info(f"Detected tempo: {tempo_value} BPM")
    logger.debug(f"Bar length: {240 / tempo_value[0]} s, Quarter note: {60 / tempo_value[0]} s, 16th note: {15 / tempo_value[0]} s")

    if title is None:
        title = os.path.splitext(os.path.basename(input_wav))[0]
        logger.info(f"Using filename as title: '{title}'")

    logger.info("Preprocessing audio...")
    preprocessed_audio = preprocess_audio(audio_data, sample_rate)

    if visualize_only:
        logger.info("Generating visualization only...")
        output_image = os.path.splitext(output_xml)[0] + "_visualization.png"
        visualize_audio(preprocessed_audio, sample_rate, output_image, tempo_value[0])
        logger.info(f"Visualization saved to: {output_image}")
        return True

    logger.info("Detecting notes and chords...")
    midi_data = detect_notes_and_chords(preprocessed_audio, sample_rate, tempo_value[0])

    logger.info("Converting to MusicXML...")
    score = midi_to_musicxml(midi_data, title=title, tp=tempo_value[0], composer=composer)

    print("Generating sheet music...")
    success = generate_sheet_music(score, output_xml, output_pdf, messy=messy, title=title)

    if visualize:
        print("Generating audio visualization...")
        output_image = os.path.splitext(output_xml)[0]
        visualize_audio(preprocessed_audio, sample_rate, output_image)
        logger.info(f"Visualization saved to: {output_image}")

    if success:
        logger.info("Conversion completed successfully")
    else:
        logger.error("Conversion completed with errors")

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
    parser.add_argument("--stem", action="store_true",
                        help="stem the audio")
    parser.add_argument("--messy", action="store_true",
                        help="turn off rest post-processing")
    parser.add_argument("--visualize-only", action="store_true",
                        help="only visualize data")
    parser.add_argument("--composer", default="Dascore",
                        help="Composer name (default: Dascore)")

    args = parser.parse_args()

    if not os.path.isdir(f"out/{args.title.replace(' ', '_')}"):
        os.mkdir(f"out/{args.title.replace(' ', '_')}")
    else:
        shutil.rmtree(f"out/{args.title.replace(' ', '_')}")
        os.mkdir(f"out/{args.title.replace(' ', '_')}")

    wav_to_sheet_music(
        args.input_wav,
        f"out/{args.title.replace(' ', '_')}/{args.output_xml}",
        title=args.title,
        visualize=args.visualize,
        stem=args.stem,
        messy=args.messy,
        visualize_only=args.visualize_only,
        output_pdf=f"out/{args.title.replace(' ', '_')}/{args.output_pdf}",
        composer=args.composer
    )
