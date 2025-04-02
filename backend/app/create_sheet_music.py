import os
import subprocess
import xml.etree.ElementTree as ET
import logging

import librosa
import librosa.display
from music21 import (clef, duration, instrument, metadata,
                     meter, note, stream, tempo, tie, converter)

from utils import setup_musescore_path
from music21 import environment
import numpy as np
environment.set(
    'musicxmlPath', '/Applications/MuseScore 4.app/Contents/MacOS/mscore')

# Initialize MuseScore path
setup_musescore_path()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
REST_GAP_THRESHOLD = 0.25
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


def transform_nested_lists(list16, list8, list4, list2, list1):
    output_list = []
    i = 0

    while i < 16:
        is_current_true = list16[i][0]

        if is_current_true:
            output_list.append([True])
            i += 1
            continue

        idx_list1 = i // 16
        if i % 16 == 0 and all(not x for x in list1[idx_list1]):
            output_list.append([False] * 16)
            i += 16
            continue

        idx_list2 = i // 8
        if i % 8 == 0 and all(not x for x in list2[idx_list2]):
            output_list.append([False] * 8)
            i += 8
            continue

        idx_list4 = i // 4
        if i % 4 == 0 and all(not x for x in list4[idx_list4]):
            output_list.append([False] * 4)
            i += 4
            continue

        idx_list8 = i // 2
        if i % 2 == 0 and all(not x for x in list8[idx_list8]):
            output_list.append([False, False])
            i += 2
            continue

        output_list.append([False])
        i += 1
        continue

    final_element_count = sum(len(sublist) for sublist in output_list)
    if final_element_count != 16:
        raise ValueError(f"Internal logic error: Final output covers {final_element_count} elements, expected 16.")

    return output_list


def combine_rests_in_measure(measure):
    new_measure = stream.Measure(number=measure.number)

    for ts in measure.getElementsByClass(meter.TimeSignature):
        new_measure.append(ts)

    note_mask = []
    for elem in measure.notesAndRests:
        note_mask += ([[isinstance(elem, note.Note)]] * int(elem.quarterLength // 0.25))

    new_note_mask = note_mask
    note_masks = [note_mask]

    for interval in [0.5, 1, 2, 4]:
        nnm = []
        for i in range(0, int(8 / interval), 2):
            mask = [y for x in new_note_mask[i:i + 2] for y in x]
            nnm += [mask]
        note_masks.append(nnm)
        new_note_mask = nnm
    
    tf = transform_nested_lists(*note_masks)

    locations = {}
    time = 0
    for elem in measure.notesAndRests:
        if isinstance(elem, note.Note):
            locations[time] = elem
        time += elem.quarterLength
    
    time = 0
    for elem in tf:
        if locations.get(time):
            new_measure.append(locations[time])
            time += locations[time].quarterLength
        if not any(elem):
            combined_rest = note.Rest(TIME_TO_REST[0.25 * len(elem)])
            new_measure.append(combined_rest)
            time += 0.25 * len(elem)

    return new_measure


def combine_rests_in_part(part, i):
    new_part = stream.Part()

    instrs = part.getElementsByClass(instrument.Instrument)
    if instrs:
        new_part.append(instrs[0])

    if i == 0:
        new_part.append(clef.TrebleClef())
    else:
        new_part.append(clef.BassClef())

    for measure in part.getElementsByClass(stream.Measure):
        new_part.append(combine_rests_in_measure(measure))

    return new_part


def combine_rests_in_score(score):
    new_score = stream.Score()
    new_score.metadata = metadata.Metadata()
    new_score.metadata.title = score.metadata.title
    for i, part in enumerate(score.getElementsByClass(stream.Part)):
        new_score.append(combine_rests_in_part(part, i))
    return new_score


def __closest(d):
    return TIME_TO_REST[min(TIME_TO_REST, key=lambda x: abs(d - x))]


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

    if midi_data.instruments and midi_data.instruments[0].notes:
        all_notes = sorted(
            midi_data.instruments[0].notes, key=lambda x: x.start)

        notes_by_time = {}

        for midi_note in all_notes:
            start_time = round(midi_note.start, 2)
            if start_time not in notes_by_time:
                notes_by_time[start_time] = []
            notes_by_time[start_time].append(midi_note)

        time_points = sorted(notes_by_time.keys())

        current_end_time = -1
        gap = __convert_to_time(time_points[0] / (1 / (tp / 4) * 15))
        treble_part.append(note.Rest(TIME_TO_REST[gap]))
        bass_part.append(note.Rest(TIME_TO_REST[gap]))

        for time_point in time_points:
            notes_at_time = notes_by_time[time_point]

            if notes_at_time:
                for note_obj in notes_at_time:
                    note_duration = __convert_to_time(
                        (note_obj.end - note_obj.start) / (1 / (tp / 4) * 15))
                    n = note.Note(note_obj.pitch)

                    if current_end_time == -1:
                        current_end_time = note_obj.end
                    else:
                        start_rest_time = note_obj.start - current_end_time
                        if start_rest_time / (1 / (tp / 4) * 15) >= REST_GAP_THRESHOLD:
                            while start_rest_time > 0:
                                gap = __convert_to_time(start_rest_time / (1 / (tp / 4) * 15))
                                treble_part.append(note.Rest(TIME_TO_REST[gap]))
                                bass_part.append(note.Rest(TIME_TO_REST[gap]))
                                start_rest_time -= (gap * (1 / (tp / 4) * 15))
                        current_end_time = note_obj.end

                    if note_duration <= 0.25:
                        n.duration = duration.Duration(type='16th')
                        r = note.Rest('16th')
                    elif note_duration <= 0.5:
                        n.duration = duration.Duration(type='eighth')
                        r = note.Rest('eighth')
                    elif note_duration <= 1.0:
                        n.duration = duration.Duration(type='quarter')
                        r = note.Rest('quarter')
                    elif note_duration <= 2.0:
                        n.duration = duration.Duration(type='half')
                        r = note.Rest('half')
                    else:
                        n.duration = duration.Duration(type='whole')
                        r = note.Rest('whole')

                    if n.pitch.midi >= 60:
                        treble_part.append(n)
                        bass_part.append(r)
                    else:
                        treble_part.append(r)
                        bass_part.append(n)

    else:
        placeholder = note.Rest()
        placeholder.duration = duration.Duration(type='whole')
        treble_part.append(placeholder)
        bass_part.append(placeholder)
        
    score.append(treble_part)
    score.append(bass_part)

    return score.makeMeasures()


def generate_sheet_music(score: stream.Score, output_xml, output_pdf=None):
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
        print(f"MusicXML file saved as: {output_xml}")
        score.write('midi', fp=output_xml.replace("xml", "mid"))
        xml_data = converter.parse(output_xml)
        score = combine_rests_in_score(xml_data)
        score.write(fmt='musicxml', fp=output_xml)
        print(f"MusicXML file edited as: {output_xml}")

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


if __name__ == "__main__":
    xml_data = converter.parse("out/trial_blue/output1.xml")
    combine_rests_in_score(xml_data).write(fmt='musicxml', fp="temp.xml")
    subprocess.run(
        ["mscore", "-o", "temp.pdf", "temp.xml"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
