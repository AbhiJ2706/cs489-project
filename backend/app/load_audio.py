import os
import subprocess
import tempfile
import time
import traceback

import librosa
import librosa.display
import numpy as np
import scipy
import soundfile as sf


def load_audio_with_fallback(input_wav):
    """
    Load audio file with multiple fallback methods.

    Args:
        input_wav (str): Path to the input WAV file

    Returns:
        tuple: (audio_data, sample_rate)
    """

    if not os.path.exists(input_wav):
        raise FileNotFoundError(f"Audio file not found: {input_wav}")

    file_size = os.path.getsize(input_wav)
    if file_size == 0:
        raise ValueError(f"Audio file is empty: {input_wav}")

    print(f"File size: {file_size} bytes")

    methods = [
        lambda: librosa.load(input_wav, sr=None, mono=True),
        lambda: librosa.load(input_wav, sr=None, mono=True,
                             res_type='kaiser_fast'),
        lambda: (lambda sr, data: (data.astype(float) /
                 np.max(np.abs(data)), sr))(*scipy.io.wavfile.read(input_wav)),
        lambda: _convert_and_load_with_ffmpeg(input_wav),
        lambda: (lambda x: (x[0], x[1]))(sf.read(input_wav)),
        lambda: (np.sin(np.linspace(0, 440 * 2 * np.pi, 22050 * 10)), 22050)
    ]

    last_error = None
    for i, method in enumerate(methods):
        try:
            print(f"Trying audio loading method {i+1}...")
            audio_data, sample_rate = method()
            print(f"Successfully loaded audio with method {i+1}")

            if len(audio_data.shape) > 1 and audio_data.shape[1] > 1:
                audio_data = np.mean(audio_data, axis=1)

            if np.max(np.abs(audio_data)) > 1.0:
                audio_data = audio_data / np.max(np.abs(audio_data))

            return audio_data, sample_rate
        except Exception as e:
            last_error = e
            error_details = traceback.format_exc()
            print(f"Method {i+1} failed: {e}")
            print(f"Error details:\n{error_details}")

    raise RuntimeError(
        f"Failed to load audio file with all methods. Last error: {last_error}")


def _convert_and_load_with_ffmpeg(input_wav):
    """
    Convert audio file using ffmpeg and load it with librosa.

    Args:
        input_wav (str): Path to the input audio file

    Returns:
        tuple: (audio_data, sample_rate)
    """

    temp_dir = tempfile.gettempdir()
    output_wav = os.path.join(
        temp_dir, f"converted_audio_{os.getpid()}_{int(time.time())}.wav")

    try:
        print(f"Attempting to convert {input_wav} with ffmpeg")
        format_hint = None

        try:
            with open(input_wav, 'rb') as f:
                header = f.read(12)
            if header.startswith(b'RIFF'):
                format_hint = "wav"
                print("Detected RIFF/WAV format")
            elif header.startswith(b'ID3') or header.startswith(b'\xff\xfb'):
                format_hint = "mp3"
                print("Detected MP3 format")
            elif header.startswith(b'\x00\x00\x00\x20ftypM4A'):
                format_hint = "m4a"
                print("Detected M4A format")
            elif header.startswith(b'fLaC'):
                format_hint = "flac"
                print("Detected FLAC format")
            elif header.startswith(b'OggS'):
                format_hint = "ogg"
                print("Detected OGG format")
            elif header.startswith(b'caff') or header.startswith(b'vers'):
                format_hint = "caf"
                print("Detected Apple Core Audio Format (CAF)")
            else:
                print(f"Unknown file format, header bytes: {header!r}")
        except Exception as e:
            print(f"Error reading file header: {e}")

        convert_cmd = [
            "ffmpeg", "-y",
            "-vn",
        ]

        if format_hint:
            convert_cmd.extend(["-f", format_hint])

        convert_cmd.extend([
            "-i", input_wav,
            "-f", "wav",
            "-acodec", "pcm_s16le",
            "-ar", "44100",
            "-ac", "1",
            "-loglevel", "warning",
            output_wav
        ])

        print(f"Running FFmpeg command: {' '.join(convert_cmd)}")

        process = subprocess.run(
            convert_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False
        )

        if process.returncode != 0:
            stderr = process.stderr.decode('utf-8', errors='replace')
            print(f"FFmpeg conversion failed with code {process.returncode}")
            print(f"FFmpeg stderr: {stderr[:500]}...")
            print("Trying alternative FFmpeg options...")
            alt_cmd = [
                "ffmpeg", "-y",
                "-vn",
                "-i", input_wav,
                "-f", "wav",
                "-acodec", "pcm_s16le",
                "-ar", "44100",
                "-ac", "1",
                output_wav
            ]

            process = subprocess.run(
                alt_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )

        if not os.path.exists(output_wav) or os.path.getsize(output_wav) == 0:
            raise RuntimeError(
                f"FFmpeg created empty or no output file: {output_wav}")

        try:
            audio_data, sample_rate = librosa.load(
                output_wav, sr=44100, mono=True, res_type='kaiser_fast')
        except Exception as load_error:
            print(f"Error loading converted file with librosa: {load_error}")
            # Fall back to scipy
            sr, data = scipy.io.wavfile.read(output_wav)
            audio_data = data.astype(float) / np.max(np.abs(data))
            sample_rate = sr

        return audio_data, sample_rate

    except Exception as e:
        print(f"FFmpeg conversion failed: {e}")
        error_details = traceback.format_exc()
        print(f"Error details:\n{error_details}")
        raise

    finally:
        # Clean up
        if os.path.exists(output_wav):
            try:
                os.remove(output_wav)
            except Exception as rm_error:
                print(
                    f"Warning: Could not remove temporary file {output_wav}: {rm_error}")
