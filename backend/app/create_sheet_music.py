import os
import subprocess
import xml.etree.ElementTree as ET

import librosa
import librosa.display
from music21 import (clef, duration, instrument, metadata,
                     meter, note, stream, tempo, tie)

from music21 import environment
environment.set(
    'musicxmlPath', '/Applications/MuseScore 4.app/Contents/MacOS/mscore')


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
NOTE_NOISE_FLOOR_MULTIPLIER = 2

TIME_TO_REST = {
    0.25: "16th",
    0.5: "eighth",
    1: "quarter",
    2: "half",
    4: "whole"
}


def __convert_to_time(note_duration):
    return min(TIME_TO_REST, key=lambda x: (note_duration - x) ** 2)


def combine_rests_in_measure(measure):
    new_measure = stream.Measure(number=measure.number)

    # Preserve initial time signature if present
    for ts in measure.getElementsByClass(meter.TimeSignature):
        new_measure.append(ts)

    combined_rest = None  # Stores ongoing rest
    for elem in measure.notesAndRests:
        if isinstance(elem, note.Rest):
            if combined_rest:
                combined_rest.quarterLength += elem.quarterLength  # Merge durations
            else:
                combined_rest = note.Rest(
                    quarterLength=elem.quarterLength)  # Start new rest
        else:
            if combined_rest:
                new_measure.append(combined_rest)  # Append merged rest
                combined_rest = None  # Reset
            new_measure.append(elem)  # Append non-rest element

    if combined_rest:
        new_measure.append(combined_rest)  # Append any remaining rest

    return new_measure


def combine_rests_in_part(part):
    new_part = stream.Part()

    instrs = part.getElementsByClass(instrument.Instrument)
    if instrs:
        new_part.append(instrs[0])

    clefs = part.getElementsByClass(clef.Clef)
    if clefs:
        new_part.append(clefs[0])

    for measure in part.getElementsByClass(stream.Measure):
        new_part.append(combine_rests_in_measure(measure))

    return new_part


def combine_rests_in_score(score):
    new_score = stream.Score()
    new_score.metadata = metadata.Metadata()
    new_score.metadata.title = score.metadata.title
    for part in score.getElementsByClass(stream.Part):
        new_score.append(combine_rests_in_part(part))
    return new_score


def __closest(d):
    return TIME_TO_REST[min(TIME_TO_REST, key=lambda x: abs(d - x))]


def __approximate(d):
    return round(2048 * d) / 2048


def midi_to_musicxml(midi_data, title="Transcribed Music", tp=120):
    try:
        tp = tp[0]
    except:
        pass

    score = stream.Score()
    score.metadata = metadata.Metadata()
    score.metadata.title = title

    treble_part = stream.Part()
    treble_part.insert(0, instrument.Piano())
    treble_part.append(clef.TrebleClef())
    treble_part.append(meter.TimeSignature('4/4'))

    bass_part = stream.Part()
    bass_part.insert(0, instrument.Piano())
    bass_part.append(clef.BassClef())
    bass_part.append(meter.TimeSignature('4/4'))

    if tp < 20 or tp > 300:
        print(
            f"Warning: Unusual tempo value ({tp}), using default of 120 BPM")
        tp = 120

    treble_part.append(tempo.MetronomeMark(number=float(tp)))
    bass_part.append(tempo.MetronomeMark(number=float(tp)))

    treble_note_list = []
    bass_note_list = []

    if midi_data.instruments and midi_data.instruments[0].notes:
        all_notes = sorted(
            midi_data.instruments[0].notes, key=lambda x: x.start)

        measure_count = 1
        current_treble_measure = stream.Measure(number=measure_count)
        current_bass_measure = stream.Measure(number=measure_count)

        bar_time = 0
        notes_by_time = {}

        for midi_note in all_notes:
            start_time = round(midi_note.start, 2)
            if start_time not in notes_by_time:
                notes_by_time[start_time] = []
            notes_by_time[start_time].append(midi_note)

        time_points = sorted(notes_by_time.keys())

        for time_point in time_points:
            notes_at_time = notes_by_time[time_point]

            if notes_at_time:
                for note_obj in notes_at_time:
                    note_duration = __convert_to_time(
                        (note_obj.end - note_obj.start) / (1 / (tp / 4) * 15))
                    n = note.Note(note_obj.pitch)

                    if note_duration <= 0.25:
                        n.duration = duration.Duration(type='16th')
                        bar_time += 0.25
                        r = note.Rest('16th')
                    elif note_duration <= 0.5:
                        n.duration = duration.Duration(type='eighth')
                        bar_time += 0.5
                        r = note.Rest('eighth')
                    elif note_duration <= 1.0:
                        n.duration = duration.Duration(type='quarter')
                        bar_time += 1.0
                        r = note.Rest('quarter')
                    elif note_duration <= 2.0:
                        n.duration = duration.Duration(type='half')
                        bar_time += 2.0
                        r = note.Rest('half')
                    else:
                        n.duration = duration.Duration(type='whole')
                        bar_time += 4.0
                        r = note.Rest('whole')

                    if bar_time == 4.0:
                        if n.pitch.midi >= 60:
                            current_treble_measure.append(n)
                            current_bass_measure.append(r)
                            treble_note_list.append(n)
                        else:
                            current_treble_measure.append(r)
                            current_bass_measure.append(n)
                            bass_note_list.append(n)
                        treble_part.append(current_treble_measure)
                        bass_part.append(current_bass_measure)

                        measure_count += 1
                        current_treble_measure = stream.Measure(
                            number=measure_count)
                        current_bass_measure = stream.Measure(
                            number=measure_count)
                        bar_time = 0.0

                    elif bar_time > 4.0:
                        extraneous_time = bar_time - 4
                        n = note.Note(n.pitch)
                        n.tie = tie.Tie('start')
                        r = note.Rest()
                        n.duration = duration.Duration(type=__closest(
                            n.duration.quarterLength - extraneous_time), quarterLength=n.duration.quarterLength - extraneous_time)
                        r.duration = duration.Duration(type=__closest(
                            n.duration.quarterLength - extraneous_time), quarterLength=n.duration.quarterLength - extraneous_time)
                        if n.pitch.midi >= 60:
                            current_treble_measure.append(n)
                            current_bass_measure.append(r)
                            treble_note_list.append(n)
                        else:
                            current_treble_measure.append(r)
                            current_bass_measure.append(n)
                            bass_note_list.append(n)
                        treble_part.append(current_treble_measure)
                        bass_part.append(current_bass_measure)

                        measure_count += 1
                        current_treble_measure = stream.Measure(
                            number=measure_count)
                        current_bass_measure = stream.Measure(
                            number=measure_count)

                        n2 = note.Note(n.pitch)
                        n2.tie = tie.Tie('stop')
                        r2 = note.Rest()
                        n2.duration = duration.Duration(type=__closest(
                            extraneous_time), quarterLength=extraneous_time)
                        r2.duration = duration.Duration(type=__closest(
                            extraneous_time), quarterLength=extraneous_time)
                        if n.pitch.midi >= 60:
                            current_treble_measure.append(n2)
                            current_bass_measure.append(r2)
                            treble_note_list.append(n2)
                        else:
                            current_treble_measure.append(r2)
                            current_bass_measure.append(n2)
                            bass_note_list.append(n2)
                        bar_time = extraneous_time

                    else:
                        if n.pitch.midi >= 60:
                            current_treble_measure.append(n)
                            current_bass_measure.append(r)
                            treble_note_list.append(n)
                        else:
                            current_treble_measure.append(r)
                            current_bass_measure.append(n)
                            bass_note_list.append(n)

    else:
        placeholder = note.Rest()
        placeholder.duration = duration.Duration(type='whole')
        current_treble_measure.append(placeholder)
        current_bass_measure.append(placeholder)
        treble_part.append(current_treble_measure)
        bass_part.append(current_bass_measure)
        measure_count += 1
        current_treble_measure = stream.Measure(number=measure_count)
        current_bass_measure = stream.Measure(number=measure_count)

    score.append(treble_part)
    score.append(bass_part)

    # new_score, = combine_rests_in_score(score).flatten().splitAtDurations()

    return score, treble_note_list, bass_note_list


def __item_to_pitch(item):
    return item.find("step").text + ["", "#", "-"][int(item.find("alter").text)] + item.find("octave").text


def generate_sheet_music(score: stream.Score, output_xml, output_pdf=None, treble_note_list: list[note.Note] = [], bass_note_list: list[note.Note] = []):
    try:
        output_dir = os.path.dirname(output_xml)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        for part in score.parts:
            if len(part.getElementsByClass('Measure')) == 0:
                print("Warning: Part has no measures. Adding a measure...")
                m = stream.Measure(number=1)
                if len(part.getElementsByClass(['Note', 'Rest'])) == 0:
                    r = note.Rest('whole')
                    m.append(r)
                else:
                    for n in part.getElementsByClass(['Note', 'Rest']):
                        m.append(n)
                part.append(m)

        score.write(fmt='musicxml', fp=output_xml, makeNotation=True)
        score.write('midi', fp=output_xml.replace("xml", "mid"))
        print(f"MusicXML file saved as: {output_xml}")

        tree = ET.parse(output_xml)
        root = tree.getroot()

        note_list_counter = 0
        note_lists = [treble_note_list, bass_note_list]

        for child in root:
            if child.tag == "part":
                note_index = 0
                note_list = note_lists[note_list_counter]
                for measure in child:
                    removal = []
                    for n in measure:
                        if n.tag == "note":
                            for pitch in n:
                                if pitch.tag == "pitch":
                                    if note_index < len(note_list):
                                        if __item_to_pitch(pitch) == str(note_list[note_index].pitch):
                                            note_index += 1
                                        else:
                                            removal.append(n)
                                    else:
                                        removal.append(n)
                    for r in removal:
                        measure.remove(r)
                note_list_counter += 1

        tree.write(output_xml)

        if output_pdf:
            try:
                subprocess.run(
                    ["mscore", "-o", output_pdf, output_xml],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                print(f"PDF file saved as: {output_pdf}")
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print(f"Warning: Could not generate PDF. Error: {e}")
                print("MuseScore is not installed or not in PATH.")
                print(
                    "You can open the MusicXML file in any notation software to view and export as PDF.")
                if output_pdf:
                    print(f"PDF file was not created: {output_pdf}")
                    return False

        return True
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error generating sheet music: {e}")
        print(f"Error details:\n{error_details}")
        return False
