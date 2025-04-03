"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Save, Music, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch, apiUrl } from "@/lib/apiUtils";

interface Note {
  measure: number;
  part: number;
  index: number;
  name: string;
  octave: number;
  accidental: string | null;
}

interface NoteEditorProps {
  fileId: string;
  musicXmlContent: string;
  onUpdateComplete: (newFileId: string) => void;
}

export function NoteEditor({ fileId, musicXmlContent, onUpdateComplete }: NoteEditorProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMeasure, setSelectedMeasure] = useState<number | null>(null);
  const [selectedPart, setSelectedPart] = useState<number | null>(null);
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editedPitch, setEditedPitch] = useState<string>("");
  const [editedAccidental, setEditedAccidental] = useState<string>("");
  const [editedOctave, setEditedOctave] = useState<number>(4);
  const [measures, setMeasures] = useState<number[]>([]);
  const [parts, setParts] = useState<number[]>([]);
  const osmdRef = useRef<any>(null);

  // Parse the MusicXML to identify measures and parts
  useEffect(() => {
    if (!musicXmlContent) return;
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(musicXmlContent, "text/xml");
      
      // Get all measures
      const measureElements = xmlDoc.querySelectorAll("measure");
      const measureNumbers = new Set<number>();
      
      measureElements.forEach((measure) => {
        const number = parseInt(measure.getAttribute("number") || "0");
        if (number > 0) {
          measureNumbers.add(number);
        }
      });
      
      // Get all parts
      const partElements = xmlDoc.querySelectorAll("part");
      const partIndices = Array.from(Array(partElements.length).keys());
      
      setMeasures(Array.from(measureNumbers).sort((a, b) => a - b));
      setParts(partIndices);
      
    } catch (error) {
      console.error("Error parsing MusicXML:", error);
    }
  }, [musicXmlContent]);

  // Function to extract notes from a specific measure and part
  const extractNotesFromMeasure = () => {
    if (selectedMeasure === null || selectedPart === null || !musicXmlContent) {
      setNotesList([]);
      return;
    }
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(musicXmlContent, "text/xml");
      
      // Find the selected part
      const partElements = xmlDoc.querySelectorAll("part");
      if (selectedPart >= partElements.length) {
        setNotesList([]);
        return;
      }
      
      const partElement = partElements[selectedPart];
      
      // Find the selected measure in the part
      const measureElements = partElement.querySelectorAll("measure");
      let targetMeasure = null;
      
      for (let i = 0; i < measureElements.length; i++) {
        const measure = measureElements[i];
        const number = parseInt(measure.getAttribute("number") || "0");
        
        if (number === selectedMeasure) {
          targetMeasure = measure;
          break;
        }
      }
      
      if (!targetMeasure) {
        setNotesList([]);
        return;
      }
      
      // Extract notes from the measure
      const noteElements = targetMeasure.querySelectorAll("note");
      const notes: Note[] = [];
      
      noteElements.forEach((noteElem, index) => {
        // Skip rests
        if (noteElem.querySelector("rest")) return;
        
        const pitchElem = noteElem.querySelector("pitch");
        if (!pitchElem) return;
        
        const step = pitchElem.querySelector("step")?.textContent || "";
        const octave = parseInt(pitchElem.querySelector("octave")?.textContent || "4");
        
        let accidental = null;
        const alterElem = pitchElem.querySelector("alter");
        if (alterElem) {
          const alter = parseInt(alterElem.textContent || "0");
          accidental = alter === 1 ? "sharp" : alter === -1 ? "flat" : null;
        }
        
        notes.push({
          measure: selectedMeasure,
          part: selectedPart,
          index,
          name: step,
          octave,
          accidental
        });
      });
      
      setNotesList(notes);
      
    } catch (error) {
      console.error("Error extracting notes:", error);
      setNotesList([]);
    }
  };

  // Extract notes when measure or part changes
  useEffect(() => {
    extractNotesFromMeasure();
  }, [selectedMeasure, selectedPart]);

  // Initialize editor with the selected note's values
  useEffect(() => {
    if (selectedNote) {
      setEditedPitch(selectedNote.name);
      setEditedAccidental(selectedNote.accidental || "");
      setEditedOctave(selectedNote.octave);
    } else {
      setEditedPitch("");
      setEditedAccidental("");
      setEditedOctave(4);
    }
  }, [selectedNote]);

  const handleSaveChanges = async () => {
    if (!selectedNote) return;
    
    setIsSaving(true);
    
    try {
      const noteUpdate = [{
        measureNumber: selectedNote.measure,
        partIndex: selectedNote.part,
        noteIndex: selectedNote.index,
        newPitch: editedPitch,
        accidental: editedAccidental || null,
        octave: editedOctave
      }];
      
      const response = await fetch(apiUrl(`musicxml-content/${fileId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noteUpdate),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update note");
      }
      
      const result = await response.json();
      
      toast({
        title: "Note updated",
        description: "The note has been successfully updated in the score.",
      });
      
      // Call the callback with the new file ID
      if (result.edited_file_id) {
        onUpdateComplete(result.edited_file_id);
      }
      
      setSelectedNote(null);
      setIsEditing(false);
      
    } catch (error) {
      console.error("Error updating note:", error);
      toast({
        title: "Update failed",
        description: "Failed to update the note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditing = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setSelectedMeasure(measures[0] || null);
      setSelectedPart(parts[0] || null);
    } else {
      setSelectedMeasure(null);
      setSelectedPart(null);
      setSelectedNote(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Music className="mr-2 h-5 w-5" />
          Sheet Music Editor
        </h2>
        <Button
          variant={isEditing ? "secondary" : "default"}
          onClick={toggleEditing}
        >
          {isEditing ? "Cancel Editing" : "Edit Notes"}
          <Edit className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="measure">Measure</Label>
                <Select
                  value={selectedMeasure?.toString() || ""}
                  onValueChange={(value) => setSelectedMeasure(parseInt(value))}
                >
                  <SelectTrigger id="measure">
                    <SelectValue placeholder="Select measure" />
                  </SelectTrigger>
                  <SelectContent>
                    {measures.map((measure) => (
                      <SelectItem key={measure} value={measure.toString()}>
                        Measure {measure}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="part">Staff</Label>
                <Select
                  value={selectedPart?.toString() || ""}
                  onValueChange={(value) => setSelectedPart(parseInt(value))}
                >
                  <SelectTrigger id="part">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {parts.map((part) => (
                      <SelectItem key={part} value={part.toString()}>
                        Staff {part + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedMeasure !== null && selectedPart !== null && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Notes in Measure {selectedMeasure}, Staff {selectedPart + 1}</h3>
                
                {notesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes found in this measure and staff.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {notesList.map((note, index) => (
                      <Button
                        key={index}
                        variant={selectedNote === note ? "default" : "outline"}
                        className="text-sm"
                        onClick={() => setSelectedNote(note)}
                      >
                        {note.name}
                        {note.accidental === "sharp" ? "♯" : note.accidental === "flat" ? "♭" : ""}
                        {note.octave}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {selectedNote && (
              <div className="mt-6 p-4 bg-muted rounded-md">
                <h3 className="text-sm font-medium mb-3">Edit Note</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="note-pitch">Pitch</Label>
                    <Select
                      value={editedPitch}
                      onValueChange={setEditedPitch}
                    >
                      <SelectTrigger id="note-pitch">
                        <SelectValue placeholder="Select pitch" />
                      </SelectTrigger>
                      <SelectContent>
                        {["C", "D", "E", "F", "G", "A", "B"].map((pitch) => (
                          <SelectItem key={pitch} value={pitch}>
                            {pitch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="note-accidental">Accidental</Label>
                    <Select
                      value={editedAccidental}
                      onValueChange={setEditedAccidental}
                    >
                      <SelectTrigger id="note-accidental">
                        <SelectValue placeholder="Select accidental" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="sharp">Sharp (♯)</SelectItem>
                        <SelectItem value="flat">Flat (♭)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="note-octave">Octave</Label>
                    <Select
                      value={editedOctave.toString()}
                      onValueChange={(value) => setEditedOctave(parseInt(value))}
                    >
                      <SelectTrigger id="note-octave">
                        <SelectValue placeholder="Select octave" />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6].map((octave) => (
                          <SelectItem key={octave} value={octave.toString()}>
                            {octave}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <Button 
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 