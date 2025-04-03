import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
from scipy.signal import find_peaks

from app.process_audio import HOP_LENGTH, NOTE_NOISE_FLOOR_MULTIPLIER, __determine_start_end_frames, __determine_valid, __track_note_peaks, determine_potential_notes


def plot_segment(segment, validity, idx, output_image):
    if validity[0]:
        xticks = validity[1]
        note_list = list(map(lambda x: librosa.midi_to_note(x + 21), validity[1]))
    else:
        xticks = np.linspace(0, segment.shape[0], segment.shape[0] // 8, dtype=int)
        note_list = [librosa.midi_to_note(n + 21) for n in xticks]

    validity_string = ', Reason(s): ' + ', '.join(
            validity[1]) if not validity[0] else f'Note(s) found: {note_list}'
    title = f"Segment 1 temporal plot ({'Valid note' if validity[0] else 'Invalid note'}{validity_string})"

    if segment.shape[1] == 1:
        plt.plot(np.arange(segment.shape[0]), segment[:, 0])
        plt.title(title)
        plt.xlabel("Bin note")
        plt.ylabel("Frame number")
        plt.xticks(xticks, note_list)
    else:
        X_indices, Y_indices = np.meshgrid(
            np.arange(segment.shape[0]), np.arange(segment.shape[1]), indexing='ij')

        X_flat = X_indices.ravel()
        Y_flat = Y_indices.ravel()
        Z_flat = segment.ravel()

        fig = plt.figure(figsize=(10, 6))
        ax: plt.Axes = fig.add_subplot(111, projection='3d')

        ax.plot_trisurf(X_flat, Y_flat, Z_flat, cmap='viridis', edgecolor='none', alpha=0.5)

        if validity[0]:
            for note in validity[1]:
                seg = segment[note, :].reshape(-1,)
                ax.plot(np.ones(segment.shape[1],) * note, np.arange(segment.shape[1]), seg, color="red", label=f"peak for {librosa.midi_to_note(note + 21)}")
                ax.legend()

        ax.set_xlabel("Bin note")
        ax.set_ylabel("Frame number")
        ax.set_zlabel("CQT Value")
        
        ax.set_xticks(xticks, note_list)
        
        ax.set_title(title)

    save_plot(output_image, f"segments_{idx}")


def find_valid_notes(audio_data, sample_rate, tempo, energy_map, noise_floor_threshold):
    min_note_duration_frames = (15 / tempo * sample_rate) // HOP_LENGTH + 1

    print(f"min note duration in frames: {min_note_duration_frames}")

    C, onset_times = determine_potential_notes(audio_data, sample_rate)

    validity = []
    segments = []

    for i in range(len(onset_times) - 1):
        start_frame, end_frame, _ = __determine_start_end_frames(
            onset_times[i], onset_times[i + 1], audio_data, sample_rate, C, noise_floor_threshold)
        
        validity.append(__determine_valid(start_frame, end_frame,
                        energy_map, min_note_duration_frames, noise_floor_threshold, add_reasons=True))
        
        segment = C[:, start_frame:end_frame]
        segments.append(segment)

        if validity[-1][0] and segment.size > 0:
            pitch_peaks = __track_note_peaks(segment)
            if not pitch_peaks:
                validity[-1] = (False, ["no peaks found"])
            else:
                validity[-1] = (True, pitch_peaks)

    return validity, segments


def save_plot(output_image, label=None):
    if output_image:
        plt.savefig(f"{output_image}_{label}")
    else:
        plt.show()
    plt.clf()


def visualize_audio(audio_data, sample_rate, output_image=None, tempo=120):
    energy_map = librosa.feature.rms(
        y=audio_data, frame_length=HOP_LENGTH, hop_length=HOP_LENGTH).reshape(-1,)
    noise_floor_threshold = NOTE_NOISE_FLOOR_MULTIPLIER * \
        np.percentile(energy_map, 10)

    audio_data = audio_data[:45*44100]

    notes, segments = find_valid_notes(
        audio_data, sample_rate, tempo, energy_map, noise_floor_threshold)

    for i, (segment, validity) in enumerate(zip(segments, notes)):
        plot_segment(segment, validity, i, output_image)

    plt.figure(figsize=(12, 8))

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
    for n, onset in zip(notes, onsets):
        plt.axvline(x=onset, color="red" if not n[0] else "green")
    save_plot(output_image, "waveform")

    plt.title('Onset (energy)')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    onsets_energy = librosa.onset.onset_strength(
        y=audio_data, sr=sample_rate, hop_length=512)
    plt.plot(onsets_energy)
    save_plot(output_image, "onset_energy")

    plt.title('Onset (phase)')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    onsets_phase = librosa.onset.onset_strength(
        y=audio_data, sr=sample_rate, hop_length=512, feature=librosa.feature.chroma_stft)
    plt.plot(onsets_phase)
    save_plot(output_image, "onset_phase")

    onset_env_energy_norm = onsets_energy / onsets_energy.max()
    onset_env_phase_norm = onsets_phase / onsets_phase.max()

    plt.title('Onset (multiplicative)')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude')
    plt.plot(onset_env_energy_norm * onset_env_phase_norm)
    save_plot(output_image, "onset_multiplicative")

    D = librosa.amplitude_to_db(np.abs(librosa.stft(audio_data)), ref=np.max)
    librosa.display.specshow(D, sr=sample_rate, x_axis='time', y_axis='log')
    plt.colorbar(format='%+2.0f dB')
    plt.title('Spectrogram')
    save_plot(output_image, "spectrogram")
