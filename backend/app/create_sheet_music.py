import os
import subprocess
import xml.etree.ElementTree as ET
import logging

import librosa
import librosa.display
from music21 import (clef, duration, instrument, metadata,
                     meter, note, stream, tempo, tie, converter, chord)

from utils import setup_musescore_path
from music21 import environment
import numpy as np

# Initialize MuseScore path
setup_musescore_path()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
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


def __transform_nested_lists(list16, list8, list4, list2, list1):
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


def __combine_rests_in_measure(measure):
    if measure.duration.quarterLength < 4:
        return None
    
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
    
    tf = __transform_nested_lists(*note_masks)

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


def __combine_rests_in_part(part, i):
    new_part = stream.Part()

    instrs = part.getElementsByClass(instrument.Instrument)
    if instrs:
        new_part.append(instrs[0])

    if i == 0:
        new_part.append(clef.TrebleClef())
    else:
        new_part.append(clef.BassClef())

    for measure in part.getElementsByClass(stream.Measure):
        new_part.append(__combine_rests_in_measure(measure))

    return new_part


def __combine_rests_in_score(score):
    # Log the original title to debug the issue
    logger.info(f"Original title before rest combination: '{score.metadata.title if score.metadata and score.metadata.title else 'None'}'")
    
    new_score = stream.Score()
    new_score.metadata = score.metadata
    
    # Ensure we're explicitly setting the title
    if score.metadata and score.metadata.title:
        new_score.metadata.title = score.metadata.title
        logger.info(f"Setting new score title to: '{new_score.metadata.title}'")
    else:
        new_score.metadata.title = "Transcribed Music"
        logger.warning("No title found in original score, using default")
    
    for i, part in enumerate(score.getElementsByClass(stream.Part)):
        new_score.append(__combine_rests_in_part(part, i))
    
    return new_score


def __closest(d):
    return TIME_TO_REST[min(TIME_TO_REST, key=lambda x: abs(d - x))]


def midi_to_musicxml(midi_data, title="Transcribed Music", tp=120, composer="Dascore"):
    try:
        tp = tp[0]
    except:
        pass

    score = stream.Score()
    score.metadata = metadata.Metadata()
    score.metadata.title = title
    score.metadata.composer = composer
    
    logger.info(f"Creating score with title: '{title}' and composer: '{composer}'")

    treble_part = stream.Part()
    treble_part.insert(0, instrument.Piano())
    treble_part.append(clef.TrebleClef())
    treble_part.append(meter.TimeSignature('4/4'))

    bass_part = stream.Part()
    bass_part.insert(0, instrument.Piano())
    bass_part.append(clef.BassClef())
    bass_part.append(meter.TimeSignature('4/4'))

    if tp < 20 or tp > 300:
        logger.warning(f"Unusual tempo value ({tp}), using default of 120 BPM")
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
        
        from pprint import pprint
        pprint(notes_by_time)

        time_points = sorted(notes_by_time.keys())

        current_end_time = -1

        for time_point in time_points:
            notes_at_time = notes_by_time[time_point]

            if len(notes_at_time) == 1:
                note_obj = notes_at_time[0]
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
                notes = []
                note_duration = __convert_to_time(
                    (notes_at_time[0].end - notes_at_time[0].start) / (1 / (tp / 4) * 15))
                for i, note_obj in enumerate(notes_at_time):
                    n = note.Note(note_obj.pitch)
                    notes.append(n)

                    if i == len(notes_at_time) - 1:
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
                    for n in notes:
                        n.duration = duration.Duration(type='16th')
                    r = note.Rest('16th')
                elif note_duration <= 0.5:
                    for n in notes:
                        n.duration = duration.Duration(type='eighth')
                    r = note.Rest('eighth')
                elif note_duration <= 1.0:
                    for n in notes:
                        n.duration = duration.Duration(type='quarter')
                    r = note.Rest('quarter')
                elif note_duration <= 2.0:
                    for n in notes:
                        n.duration = duration.Duration(type='half')
                    r = note.Rest('half')
                else:
                    for n in notes:
                        n.duration = duration.Duration(type='whole')
                    r = note.Rest('whole')

                c = chord.Chord(notes)
                if notes[0].pitch.midi >= 60:
                    treble_part.append(c)
                    bass_part.append(r)
                else:
                    treble_part.append(r)
                    bass_part.append(c)

    else:
        placeholder = note.Rest()
        placeholder.duration = duration.Duration(type='whole')
        treble_part.append(placeholder)
        bass_part.append(placeholder)
        
    score.append(treble_part)
    score.append(bass_part)

    score.makeMeasures(inPlace=True)
    
    return score


def generate_sheet_music(score: stream.Score, output_xml, output_pdf=None, messy=False, title=None):
    try:
        # Store the original metadata
        original_title = None
        original_composer = None
        
        if score.metadata:
            if score.metadata.title:
                original_title = score.metadata.title
                logger.info(f"Processing score with title: '{original_title}'")
            
            if score.metadata.composer:
                original_composer = score.metadata.composer
                logger.info(f"Processing score with composer: '{original_composer}'")
        
        output_dir = os.path.dirname(output_xml)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        for part in score.parts:
            if len(part.getElementsByClass('Measure')) == 0:
                logger.warning("Part has no measures. Adding a measure...")
                m = stream.Measure(number=1)
                if len(part.getElementsByClass(['Note', 'Rest'])) == 0:
                    r = note.Rest('whole')
                    m.append(r)
                else:
                    for n in part.getElementsByClass(['Note', 'Rest']):
                        m.append(n)
                part.append(m)

        score.write(fmt='musicxml', fp=output_xml, makeNotation=True)
        logger.info(f"MusicXML file saved: {output_xml}")
        score.write('midi', fp=output_xml.replace("xml", "mid"))
        
        if not messy:
            xml_data = converter.parse(output_xml)
            
            # Ensure metadata is preserved after parsing
            if not xml_data.metadata:
                xml_data.metadata = metadata.Metadata()
                
            if original_title:
                xml_data.metadata.title = original_title
                logger.info(f"Restored title metadata after parsing: '{original_title}'")
                
            if original_composer:
                xml_data.metadata.composer = original_composer
                logger.info(f"Restored composer metadata after parsing: '{original_composer}'")
            
            score = __combine_rests_in_score(xml_data)
            
            # Double check metadata is still there
            if not score.metadata:
                score.metadata = metadata.Metadata()
                
            if original_title and (not score.metadata.title or score.metadata.title != original_title):
                score.metadata.title = original_title
                logger.info(f"Re-applied title metadata after rest combination: '{original_title}'")
                
            if original_composer and (not score.metadata.composer or score.metadata.composer != original_composer):
                score.metadata.composer = original_composer
                logger.info(f"Re-applied composer metadata after rest combination: '{original_composer}'")
            
            score.write(fmt='musicxml', fp=output_xml)
            logger.info(f"MusicXML file processed with rest combination: {output_xml}")

        if output_pdf:
            try:
                # Force metadata into the XML file before sending to MuseScore
                tree = ET.parse(output_xml)
                root = tree.getroot()
                
                # Handle title
                if original_title:
                    # Find or create work-title element
                    work = root.find(".//work")
                    if work is None:
                        # Create work element if it doesn't exist
                        identification = root.find(".//identification")
                        if identification is not None:
                            work = ET.Element("work")
                            root.insert(0, work)
                    
                    if work is not None:
                        work_title = work.find("work-title")
                        if work_title is None:
                            work_title = ET.SubElement(work, "work-title")
                        work_title.text = original_title
                        
                        # Also set movement-title if present
                        movement_title = root.find(".//movement-title")
                        if movement_title is not None:
                            movement_title.text = original_title
                
                # Handle composer
                if original_composer:
                    # Find or create identification/creator element
                    identification = root.find(".//identification")
                    if identification is None:
                        identification = ET.Element("identification")
                        root.insert(1 if root.find(".//work") is not None else 0, identification)
                    
                    creator = identification.find("./creator[@type='composer']")
                    if creator is None:
                        creator = ET.SubElement(identification, "creator")
                        creator.set("type", "composer")
                    creator.text = original_composer
                
                # Write back to file
                tree.write(output_xml)
                logger.info(f"Manually corrected metadata in XML file: Title='{original_title}', Composer='{original_composer}'")
                
                # Get the proper mscore path from music21 environment
                env = environment.Environment()
                mscore_path = env.get('musicxmlPath')
                logger.info(f"Using MuseScore path from environment: {mscore_path}")
                
                subprocess.run(
                    [mscore_path, "-o", output_pdf, output_xml],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                logger.info(f"PDF file created: {output_pdf}")
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print(f"Warning: Could not generate PDF. Error: {e}")
                print(
                    "You can open the MusicXML file in any notation software to view and export as PDF.")
                if not messy:
                    print("the error may have been caused by rest correction. falling back to uncorrected score.")
                    try:
                        score.write(fmt='musicxml', fp=output_xml, makeNotation=True)
                        # Get the proper mscore path from music21 environment
                        env = environment.Environment()
                        mscore_path = env.get('musicxmlPath')
                        logger.info(f"Using MuseScore path from environment (fallback): {mscore_path}")
                        
                        subprocess.run(
                            [mscore_path, "-o", output_pdf, output_xml],
                            check=True,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE
                        )
                        print(f"PDF file saved as: {output_pdf}")
                    except (subprocess.CalledProcessError, FileNotFoundError) as e:
                        print(f"Warning: Could not generate PDF. Error: {e}")
                        print("You can open the MusicXML file in any notation software to view and export as PDF.")
                        print("fallback creation failed.")

        return True
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error generating sheet music: {e}")
        logger.debug(f"Error details:\n{error_details}")
        return False


if __name__ == "__main__":
    xml_data = converter.parse("out/trial_blue/output1.xml")
    __combine_rests_in_score(xml_data).write(fmt='musicxml', fp="temp.xml")
    subprocess.run(
        ["mscore", "-o", "temp.pdf", "temp.xml"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
