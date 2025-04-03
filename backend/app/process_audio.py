import librosa  # Keep for frequency calculations if needed
from scipy.signal import find_peaks
import librosa
import librosa.display
import noisereduce as nr
import numpy as np
import pretty_midi
from pedalboard import Compressor, Gain, LowShelfFilter, NoiseGate, Pedalboard
from scipy.signal import butter, filtfilt, find_peaks

from app.utils import setup_musescore_path

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
    
    return (valid, reasons)


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
        
        valid, _ = __determine_valid(start_frame, end_frame, energy_map, min_note_duration_frames, noise_floor_threshold)
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
