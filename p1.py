import librosa
import librosa.display
import numpy as np
import pretty_midi
import matplotlib.pyplot as plt
import noisereduce as nr
from pedalboard import *

def audio_to_midi(audio_file, output_midi):
    # Load audio file
    y, sr = librosa.load(audio_file, sr=None, mono=True)

    reduced_noise = nr.reduce_noise(y=y, sr=sr, stationary=True, prop_decrease=0.75)

    board = Pedalboard([
        NoiseGate(threshold_db=-30, ratio=1.5, release_ms=250),
        Compressor(threshold_db=-16, ratio=4),
        LowShelfFilter(cutoff_frequency_hz=400, gain_db=10, q=1),
        Gain(gain_db=2)
    ])

    effected = board(reduced_noise, sr)
    
    # Harmonic-Percussive Source Separation
    y_harmonic, _ = librosa.effects.hpss(effected)
    
    # Pitch estimation using pYIN
    pitches, magnitudes = librosa.piptrack(y=y_harmonic, sr=sr)
    
    # Convert pitch matrix to MIDI notes
    midi = pretty_midi.PrettyMIDI()
    piano = pretty_midi.Instrument(program=0)
    
    time_step = librosa.frames_to_time(np.arange(pitches.shape[1]), sr=sr)
    
    for t in range(pitches.shape[1]):
        index = np.argmax(magnitudes[:, t])
        pitch = pitches[index, t]
        
        if pitch > 0:
            midi_note = librosa.hz_to_midi(pitch)
            note = pretty_midi.Note(
                velocity=100,
                pitch=int(midi_note),
                start=time_step[t],
                end=time_step[min(t + 1, len(time_step) - 1)]
            )
            piano.notes.append(note)
    
    midi.instruments.append(piano)
    midi.write(output_midi)
    print(f"MIDI file saved as {output_midi}")

# Example usage
audio_file = "input2.wav"
output_midi = "output_song.mid"
audio_to_midi(audio_file, output_midi)
