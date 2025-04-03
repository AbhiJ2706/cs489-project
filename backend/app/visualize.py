import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
from scipy.signal import find_peaks

from app.process_audio import HOP_LENGTH, NOTE_NOISE_FLOOR_MULTIPLIER, __determine_start_end_frames, __determine_valid, __track_note_peaks, determine_potential_notes


def find_valid_notes(audio_data, sample_rate, tempo, energy_map, noise_floor_threshold):
    min_note_duration_frames = (15 / tempo * sample_rate) // HOP_LENGTH + 1

    print(f"min note duration in frames: {min_note_duration_frames}")

    C, onset_times = determine_potential_notes(audio_data, sample_rate)

    validity = []

    for i in range(len(onset_times) - 1):
        start_frame, end_frame, end_time = __determine_start_end_frames(
            onset_times[i], onset_times[i + 1], audio_data, sample_rate, C, noise_floor_threshold)

        validity.append(__determine_valid(start_frame, end_frame,
                        energy_map, min_note_duration_frames, noise_floor_threshold, add_reasons=True))
        
        if validity[-1][0]:
            segment = C[:, start_frame:end_frame]

            if segment.size > 0:
                pitch_peaks = __track_note_peaks(segment)
                if not pitch_peaks: 
                    validity[-1] = (False, "no peaks found")
                else:
                    validity[-1] = (True, pitch_peaks)

    return validity


def visualize_audio(audio_data, sample_rate, output_image=None, tempo=120):
    """
    Visualize the audio waveform and spectrogram.

    Args:
        audio_data (numpy.ndarray): The audio data
        sample_rate (int): The sample rate of the audio
        output_image (str, optional): Path to save the visualization
    """

    energy_map = librosa.feature.rms(
        y=audio_data, frame_length=HOP_LENGTH, hop_length=HOP_LENGTH).reshape(-1,)
    noise_floor_threshold = NOTE_NOISE_FLOOR_MULTIPLIER * \
        np.percentile(energy_map, 10)
    
    audio_data = audio_data[:45*44100]

    notes = find_valid_notes(audio_data, sample_rate, tempo, energy_map, noise_floor_threshold)
    plt.clf()

    plt.figure(figsize=(24, 16))
    plt.tight_layout()

    plt.subplot(6, 1, 1)
    librosa.display.waveshow(audio_data, sr=sample_rate)
    plt.title('Waveform')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')

    for note in notes:
        print(note)

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
    for n, onset in zip(notes, onsets):
        plt.axvline(x=onset, color="red" if not n[0] else "green")

    plt.subplot(6, 1, 2)
    plt.title('Onset (energy)')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    onsets_energy = librosa.onset.onset_strength(
        y=audio_data, sr=sample_rate, hop_length=512)
    plt.plot(onsets_energy)

    plt.subplot(6, 1, 3)
    plt.title('Onset (phase)')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    onsets_phase = librosa.onset.onset_strength(
        y=audio_data, sr=sample_rate, hop_length=512, feature=librosa.feature.chroma_stft)
    plt.plot(onsets_phase)

    onset_env_energy_norm = onsets_energy / onsets_energy.max()
    onset_env_phase_norm = onsets_phase / onsets_phase.max()

    plt.subplot(6, 1, 4)
    plt.title('Onset (multiplicative)')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    plt.plot(onset_env_energy_norm * onset_env_phase_norm)

    plt.subplot(6, 1, 5)
    D = librosa.amplitude_to_db(np.abs(librosa.stft(audio_data)), ref=np.max)
    librosa.display.specshow(D, sr=sample_rate, x_axis='time', y_axis='log')
    plt.colorbar(format='%+2.0f dB')
    plt.title('Spectrogram')

    if output_image:
        plt.savefig(output_image)
    else:
        plt.tight_layout()
        plt.show()
