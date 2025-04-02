import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
from scipy.signal import find_peaks


def visualize_audio(audio_data, sample_rate, output_image=None):
    """
    Visualize the audio waveform and spectrogram.

    Args:
        audio_data (numpy.ndarray): The audio data
        sample_rate (int): The sample rate of the audio
        output_image (str, optional): Path to save the visualization
    """

    plt.figure(figsize=(12, 8))

    plt.subplot(3, 1, 1)
    librosa.display.waveshow(audio_data, sr=sample_rate)
    plt.title('Waveform')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')

    onset_strength = librosa.onset.onset_strength(
        y=audio_data, sr=sample_rate, hop_length=512)

    onsets = librosa.frames_to_time(
        librosa.onset.onset_detect(
            y=audio_data,
            sr=sample_rate,
            hop_length=512,
            backtrack=True,
            onset_envelope=np.where(onset_strength >= 0.85, onset_strength, 0)
        ),
        sr=sample_rate,
        hop_length=512
    )
    for onset in onsets:
        plt.axvline(x=onset, color="red")

    plt.subplot(3, 1, 2)
    plt.title('Waveform')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    onsets = librosa.onset.onset_strength(
        y=audio_data, sr=sample_rate, hop_length=512)
    peaks = find_peaks(np.array(onsets.reshape(-1,)))[0]
    mask = np.zeros(onsets.size, dtype=bool)
    mask[peaks] = True
    plt.plot(np.where(mask, onsets, 0))

    plt.subplot(3, 1, 3)
    D = librosa.amplitude_to_db(np.abs(librosa.stft(audio_data)), ref=np.max)
    librosa.display.specshow(D, sr=sample_rate, x_axis='time', y_axis='log')
    plt.colorbar(format='%+2.0f dB')
    plt.title('Spectrogram')

    if output_image:
        plt.savefig(output_image)
    else:
        plt.tight_layout()
        plt.show()
