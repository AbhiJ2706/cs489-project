import librosa  # Keep for frequency calculations if needed
from scipy.signal import find_peaks
import librosa
import librosa.display
import noisereduce as nr
import numpy as np
import pretty_midi
from pedalboard import Compressor, Gain, LowShelfFilter, NoiseGate, Pedalboard
from scipy.signal import butter, filtfilt, find_peaks

from utils import setup_musescore_path

# Initialize MuseScore path
setup_musescore_path()

LOW_FREQUENCY = 25
HIGH_FREQEUNCY = 4200

HOP_LENGTH = 512
N_BINS = 84
BINS_PER_OCTAVE = 12

FMIN = librosa.note_to_hz('A0')
MIDI_MIN = librosa.note_to_midi('A0')
MIDI_MAX = librosa.note_to_midi('C8')

ONSET_STRENGTH_THRESHOLD = 0.85
SILENCE_THRESHOLD = 0.007
PEAK_ENERGY_THRESHOLD = 0.7
NOTE_NOISE_FLOOR_MULTIPLIER = 2

TIME_TO_REST = {
    0.25: "16th",
    0.5: "eighth",
    1: "quarter",
    2: "half",
    4: "whole"
}

MIN_CONSECUTIVE_SILENT_FRAMES = 3
MAX_CONSECUTIVE_SILENT_FRAMES = 20
CONSECUTIVE_SLIENT_FRAME_PERCENTAGE = 0.1


def preprocess_audio(audio_data, sample_rate):
    audio_data = librosa.util.normalize(audio_data)

    reduced_noise = nr.reduce_noise(
        y=audio_data,
        sr=sample_rate,
        stationary=True,
        prop_decrease=0.85
    )

    board = Pedalboard([
        NoiseGate(threshold_db=-40, ratio=2.0, release_ms=250),
        Compressor(threshold_db=-20, ratio=4),
        LowShelfFilter(cutoff_frequency_hz=300, gain_db=3, q=1),
        Gain(gain_db=3)
    ])

    processed_audio = board(reduced_noise, sample_rate)

    harmonic_audio, _ = librosa.effects.hpss(
        processed_audio,
        margin=(1.0, 5.0)
    )

    nyquist = sample_rate / 2
    low_cutoff = LOW_FREQUENCY / nyquist
    high_cutoff = HIGH_FREQEUNCY / nyquist

    b, a = butter(4, [low_cutoff, high_cutoff], btype='band')
    filtered_audio = filtfilt(b, a, harmonic_audio)

    return filtered_audio


def __determine_start_end_frames(start_time, end_time, audio_data, sample_rate, cqt, noise_floor_threshold):
    start_frame = librosa.time_to_frames(
        start_time, sr=sample_rate, hop_length=HOP_LENGTH)
    end_frame = librosa.time_to_frames(
        end_time, sr=sample_rate, hop_length=HOP_LENGTH)

    start_frame = max(0, min(start_frame, cqt.shape[1] - 1))
    end_frame = max(0, min(end_frame, cqt.shape[1] - 1))

    start_audio_index = int(start_time * sample_rate)
    end_audio_index = int(end_time * sample_rate)

    audio_slice = audio_data[start_audio_index:end_audio_index]

    energy_time = librosa.feature.rms(
        y=audio_slice, frame_length=HOP_LENGTH, hop_length=HOP_LENGTH).reshape(-1)

    min_silent_run = min(MAX_CONSECUTIVE_SILENT_FRAMES, max([MIN_CONSECUTIVE_SILENT_FRAMES, CONSECUTIVE_SLIENT_FRAME_PERCENTAGE * (end_frame - start_frame)]))

    below_threshold_indices = np.where(energy_time <= noise_floor_threshold)[0]

    first_sustained_silent_frame_idx = len(energy_time)

    if below_threshold_indices.size >= min_silent_run:
        diff = np.diff(below_threshold_indices)
        split_indices = np.where(diff != 1)[0] + 1
        consecutive_groups = np.split(below_threshold_indices, split_indices)

        for group in consecutive_groups:
            if len(group) >= min_silent_run:
                first_sustained_silent_frame_idx = group[0]
                break

    idx = first_sustained_silent_frame_idx

    duration_offset_seconds = idx * HOP_LENGTH / sample_rate
    new_end_time = start_time + duration_offset_seconds

    new_end_time = min(new_end_time, end_time)
    new_end_time = max(new_end_time, start_time + (HOP_LENGTH / sample_rate))


    new_end_frame = librosa.time_to_frames(
        new_end_time, sr=sample_rate, hop_length=HOP_LENGTH)
    new_end_frame = max(start_frame + 1, min(new_end_frame, cqt.shape[1]))
    
    return start_frame, new_end_frame, new_end_time


def __track_note_peaks(segment):
    data = [find_peaks(x, height=0.7) for x in segment.T]
    peaks = [d[0] for d in data]
    energy = [d[1]['peak_heights'] for d in data]
    peak_tracker = dict()
    peak_energy = dict()
    for i, (frame, frame_energy) in enumerate(zip(peaks, energy)):
        for (item, e) in zip(frame, frame_energy):
            peak_tracker[item] = peak_tracker.get(item, []) + [i]
            peak_energy[item] = peak_energy.get(item, []) + [e]
    result = []
    for peak in peak_tracker:
        if len(peak_tracker[peak]) > PEAK_ENERGY_THRESHOLD * segment.shape[1]:
            result.append(peak)
    return result


# --- Tunable Parameters for the new method ---
# Minimum prominence for a CQT bin to be considered a peak within a frame.
# Needs tuning! Start low (e.g., 0.1 or lower) and increase if too much noise.
# Prominence is relative to the peak's neighbors in the *frequency* domain.
PEAK_PROMINENCE_THRESHOLD = 0.1

# Minimum number of frames a potential note peak must be detected
# (after harmonic filtering) to be considered a real note.
# Relates to the minimum note duration you want to detect.
MIN_FRAMES_FOR_NOTE = 3  # Adjust based on tempo/min_note_duration_frames

# Tolerance for harmonic matching (in cents). 100 cents = 1 semitone.
# How far can a peak be from an exact harmonic multiple to be considered related?
HARMONIC_TOLERANCE_CENTS = 50

# How many harmonics to check for when validating a fundamental.
N_HARMONICS_TO_CHECK = 5

# Strength ratio: How much weaker can a harmonic be compared to its fundamental
# while still 'supporting' that fundamental? (e.g., 0.1 = harmonic must be >10% of fundamental peak height)
HARMONIC_SUPPORT_RATIO = 0.05

# Strength ratio: How much stronger must a fundamental be than a potential peak
# *at its own frequency* if that peak is suspected of being a harmonic of *another* lower note?
# Avoids a peak being wrongly suppressed if it's genuinely strong.
FUNDAMENTAL_STRENGTH_OVER_HARMONIC = 1.5  # Must be > 1


def detect_notes_with_harmonics(cqt_segment: np.ndarray,
                                sample_rate: float,  # Needed if converting bins to Hz
                                hop_length: int,    # Needed if converting bins to Hz
                                fmin: float,        # CQT fmin
                                bins_per_octave: int,
                                min_note_duration_frames: int = 3  # Use the value from outer scope
                                ) -> list[int]:
    """
    Detects potential notes in a CQT segment using peak picking with
    prominence and basic harmonic filtering.

    Args:
        cqt_segment: 2D numpy array (bins, frames) of CQT magnitudes.
        sample_rate: Audio sample rate.
        hop_length: Hop length used for CQT.
        fmin: Minimum frequency used for CQT.
        bins_per_octave: Bins per octave used for CQT.
        min_note_duration_frames: Minimum frames a note should be active.

    Returns:
        A list of CQT bin indices corresponding to detected fundamental pitches.
    """
    n_bins, n_frames = cqt_segment.shape
    if n_frames == 0:
        return []

    # Calculate CQT bin frequencies for harmonic checks
    # Note: These are center frequencies.
    cqt_frequencies = librosa.cqt_frequencies(n_bins=n_bins,
                                              fmin=fmin,
                                              bins_per_octave=bins_per_octave)

    # Store detected peaks: {bin_index: [(frame_index, peak_magnitude), ...]}
    all_peaks = {}

    # 1. Find prominent peaks in each frame
    for frame_idx in range(n_frames):
        frame_magnitudes = cqt_segment[:, frame_idx]

        # Normalize frame magnitudes for more consistent prominence? Optional but can help.
        # frame_magnitudes = librosa.util.normalize(frame_magnitudes) # Try with/without

        peaks, properties = find_peaks(frame_magnitudes,
                                       prominence=PEAK_PROMINENCE_THRESHOLD)

        for i, peak_bin in enumerate(peaks):
            magnitude = frame_magnitudes[peak_bin]
            if peak_bin not in all_peaks:
                all_peaks[peak_bin] = []
            all_peaks[peak_bin].append((frame_idx, magnitude))

    if not all_peaks:
        return []

    # 2. Harmonic Analysis and Filtering
    potential_notes = {}  # {bin_index: total_magnitude_over_time}

    # Sort potential fundamentals by frequency (bin index)
    sorted_bins = sorted(all_peaks.keys())

    # Keep track of bins explained away as harmonics
    suppressed_as_harmonic = set()

    for f_bin in sorted_bins:
        if f_bin in suppressed_as_harmonic:
            continue

        peak_occurrences = all_peaks[f_bin]
        # Initial check: Must occur for at least minimum duration
        if len(peak_occurrences) < min_note_duration_frames:
            continue

        f_hz = cqt_frequencies[f_bin]
        avg_magnitude = np.mean([mag for _, mag in peak_occurrences])

        is_likely_harmonic = False
        # Check if this bin 'f_bin' is likely a harmonic of a *lower* detected fundamental
        for lower_bin in sorted_bins:
            if lower_bin >= f_bin:
                break  # Only check lower fundamentals
            if lower_bin in suppressed_as_harmonic or lower_bin not in potential_notes:
                continue  # Only check against confirmed potential notes

            lower_f_hz = cqt_frequencies[lower_bin]
            # Use stored avg magnitude
            lower_avg_magnitude = potential_notes[lower_bin]

            # Check integer multiples (harmonics)
            for n in range(2, N_HARMONICS_TO_CHECK + 1):
                harmonic_hz = lower_f_hz * n
                # Check if f_hz is close to this harmonic frequency
                cents_diff = abs(1200 * np.log2(f_hz / harmonic_hz))

                if cents_diff < HARMONIC_TOLERANCE_CENTS:
                    # It's potentially a harmonic. Suppress it ONLY if the lower note
                    # is sufficiently strong compared to this peak.
                    if lower_avg_magnitude * FUNDAMENTAL_STRENGTH_OVER_HARMONIC > avg_magnitude:
                        is_likely_harmonic = True
                        suppressed_as_harmonic.add(f_bin)
                        # print(f"Suppressing bin {f_bin} ({f_hz:.1f} Hz) as likely harmonic {n} of bin {lower_bin} ({lower_f_hz:.1f} Hz)")
                        break  # Stop checking harmonics for this lower_bin
            if is_likely_harmonic:
                break  # Stop checking other lower_bins

        # If it wasn't suppressed as a harmonic of a lower note, add it as potential note
        if not is_likely_harmonic:
            potential_notes[f_bin] = avg_magnitude
            # Optional: Check for harmonic support (boost confidence if harmonics are present)
            # harmonic_support = 0
            # for n in range(2, N_HARMONICS_TO_CHECK + 1):
            #     harmonic_hz = f_hz * n
            #     # Find closest bin to harmonic_hz
            #     if harmonic_hz <= cqt_frequencies[-1]:
            #         harmonic_bin = np.argmin(np.abs(cqt_frequencies - harmonic_hz))
            #         if harmonic_bin in all_peaks:
            #              # Check if harmonic peaks overlap in time with fundamental peaks? (more complex)
            #              harmonic_avg_mag = np.mean([m for _, m in all_peaks[harmonic_bin]])
            #              if harmonic_avg_mag > avg_magnitude * HARMONIC_SUPPORT_RATIO:
            #                    harmonic_support +=1

    # 3. Final Selection
    # Return the bins that survived the harmonic filtering and duration check
    final_note_bins = sorted(list(potential_notes.keys()))

    return final_note_bins


def determine_potential_notes(audio_data, sample_rate):
    C = np.abs(librosa.cqt(
        audio_data,
        sr=sample_rate,
        hop_length=HOP_LENGTH,
        bins_per_octave=BINS_PER_OCTAVE,
        n_bins=N_BINS,
        fmin=FMIN
    ))

    C = librosa.util.normalize(C, axis=0)

    onset_strength = librosa.onset.onset_strength(
        y=audio_data, sr=sample_rate, hop_length=HOP_LENGTH)

    onsets = librosa.onset.onset_detect(
        y=audio_data,
        sr=sample_rate,
        hop_length=HOP_LENGTH,
        backtrack=True,
        onset_envelope=np.where(
            onset_strength >= ONSET_STRENGTH_THRESHOLD, onset_strength, 0)
    )

    if len(onsets) == 0:
        print("No onsets detected. Creating artificial segments.")
        segment_length = int(0.5 * sample_rate / HOP_LENGTH)
        onsets = np.arange(0, len(audio_data) //
                           HOP_LENGTH, segment_length)

    onset_times = librosa.frames_to_time(
        onsets, sr=sample_rate, hop_length=HOP_LENGTH)

    total_duration = librosa.get_duration(y=audio_data, sr=sample_rate)
    onset_times = np.append(onset_times, total_duration)

    return C, onset_times


def __determine_valid(start_frame, end_frame, energy_map, min_note_duration_frames, noise_floor_threshold, add_reasons=False):
    valid = True
    reasons = []
    if start_frame >= end_frame - min_note_duration_frames:
        valid = False
        if add_reasons: reasons.append(f"not enough frames ({end_frame - start_frame} < {min_note_duration_frames})")
    if start_frame > end_frame and np.mean(energy_map[start_frame:end_frame]) <= noise_floor_threshold:
        valid = False
        if add_reasons: reasons.append(f"too quiet ({np.mean(energy_map[start_frame:end_frame])} < {noise_floor_threshold})")
    
    return (valid, *reasons)


def detect_notes_and_chords(audio_data, sample_rate, tempo):

    min_note_duration_frames = (15 / tempo * sample_rate) // HOP_LENGTH + 1
    energy_map = librosa.feature.rms(
        y=audio_data, frame_length=HOP_LENGTH, hop_length=HOP_LENGTH).reshape(-1,)
    noise_floor_threshold = NOTE_NOISE_FLOOR_MULTIPLIER * \
        np.percentile(energy_map, 10)

    print(f"min note duration in frames: {min_note_duration_frames}")

    C, onset_times = determine_potential_notes(audio_data, sample_rate)

    midi_data = pretty_midi.PrettyMIDI()
    piano = pretty_midi.Instrument(program=0)

    for i in range(len(onset_times) - 1):
        start_frame, end_frame, end_time = __determine_start_end_frames(
            onset_times[i], onset_times[i + 1], audio_data, sample_rate, C, noise_floor_threshold)
        
        valid, = __determine_valid(start_frame, end_frame, energy_map, min_note_duration_frames, noise_floor_threshold)
        if not valid: continue

        segment = C[:, start_frame:end_frame]

        if segment.size > 0:
            pitch_peaks = __track_note_peaks(segment)

            for peak in pitch_peaks:
                midi_note = peak + MIDI_MIN

                if MIDI_MIN <= midi_note <= MIDI_MAX:
                    velocity = int(min(127, 40 + np.mean(segment) * 100))
                    note = pretty_midi.Note(
                        velocity=velocity,
                        pitch=midi_note,
                        start=onset_times[i],
                        end=end_time
                    )

                    piano.notes.append(note)

    midi_data.instruments.append(piano)
    midi_data = __quantize_notes(midi_data)

    return midi_data


def __quantize_notes(midi_data, ticks_per_beat=480, beats_per_measure=4):
    quantized_midi = pretty_midi.PrettyMIDI(resolution=ticks_per_beat)

    for instrument in midi_data.instruments:
        quantized_instrument = pretty_midi.Instrument(
            program=instrument.program,
            is_drum=instrument.is_drum,
            name=instrument.name
        )

        notes_by_start = {}
        for note in instrument.notes:
            start_beat = midi_data.time_to_tick(note.start) / ticks_per_beat
            quantized_start_beat = round(start_beat * 16) / 16

            if quantized_start_beat not in notes_by_start:
                notes_by_start[quantized_start_beat] = []
            notes_by_start[quantized_start_beat].append(note)

        for start_beat, notes in notes_by_start.items():
            for note in notes:
                end_beat = midi_data.time_to_tick(note.end) / ticks_per_beat
                quantized_end_beat = round(end_beat * 16) / 16

                if quantized_end_beat <= start_beat:
                    quantized_end_beat = start_beat + 0.25

                quantized_start = midi_data.tick_to_time(
                    int(start_beat * ticks_per_beat))
                quantized_end = midi_data.tick_to_time(
                    int(quantized_end_beat * ticks_per_beat))

                quantized_note = pretty_midi.Note(
                    velocity=note.velocity,
                    pitch=note.pitch,
                    start=quantized_start,
                    end=quantized_end
                )

                quantized_instrument.notes.append(quantized_note)

        quantized_midi.instruments.append(quantized_instrument)

    return quantized_midi
