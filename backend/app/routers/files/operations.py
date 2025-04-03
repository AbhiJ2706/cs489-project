"""
File operations endpoints.
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import FileResponse, Response
from music21 import converter, note

from app.config import TEMP_DIR

router = APIRouter(tags=["files"])

@router.get("/download/{file_type}/{file_id}")
async def download_file(file_type: str, file_id: str):
    """
    Download a converted file.
    
    Args:
        file_type: Type of file to download (musicxml or pdf)
        file_id: ID of the file to download
        
    Returns:
        FileResponse: The requested file
    """
    if file_type not in ["musicxml", "pdf"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    file_path = TEMP_DIR / f"{file_id}.{file_type}"
    
    if not file_path.exists():
        if file_type == "pdf":
            raise HTTPException(status_code=404, detail="PDF file could not be generated. Please download the MusicXML file instead.")
        else:
            raise HTTPException(status_code=404, detail="File not found")
    
    filename = f"sheet_music.{file_type}"
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

@router.get("/preview/{file_id}")
async def preview_pdf(file_id: str):
    """
    Get the PDF file for preview.
    
    Args:
        file_id: ID of the PDF file to preview
        
    Returns:
        FileResponse: The PDF file
    """
    file_path = TEMP_DIR / f"{file_id}.pdf"
    
    if not file_path.exists():
        # Check if MusicXML exists
        musicxml_path = TEMP_DIR / f"{file_id}.musicxml"
        if musicxml_path.exists():
            raise HTTPException(
                status_code=404, 
                detail="PDF preview is not available, but you can download the MusicXML file."
            )
        else:
            raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline; filename=sheet_music.pdf",
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*"
        }
    )

@router.get("/musicxml-content/{file_id}")
async def get_musicxml_content(file_id: str):
    """
    Get the MusicXML content for browser rendering.
    
    Args:
        file_id: ID of the MusicXML file
        
    Returns:
        Response: The MusicXML content as text/xml
    """
    file_path = TEMP_DIR / f"{file_id}.musicxml"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="MusicXML file not found")
    
    with open(file_path, "r") as f:
        content = f.read()
    
    return Response(content=content, media_type="text/xml")

@router.put("/musicxml-content/{file_id}")
async def update_musicxml(
    file_id: str, 
    note_updates: list = Body(...),
):
    """
    Update notes in a MusicXML file.
    
    Args:
        file_id: ID of the MusicXML file
        note_updates: List of note updates with format:
            [
                {
                    "measureNumber": int,
                    "partIndex": int,
                    "noteIndex": int,
                    "newPitch": str,
                    "accidental": str (optional),
                    "octave": int (optional)
                },
                ...
            ]
        
    Returns:
        dict: Result message
    """
    file_path = TEMP_DIR / f"{file_id}.musicxml"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="MusicXML file not found")

    try:
        # Parse the MusicXML file
        score = converter.parse(str(file_path))
        
        # Apply the note updates
        for update in note_updates:
            measure_number = update["measureNumber"]
            part_index = update["partIndex"]
            note_index = update["noteIndex"]
            new_pitch = update["newPitch"]
            accidental = update.get("accidental", None)
            octave = update.get("octave", None)
            
            # Get the part
            if part_index >= len(score.parts):
                continue
            
            part = score.parts[part_index]
            
            # Get the measure
            measures = part.getElementsByClass('Measure')
            measure = None
            for m in measures:
                if m.number == measure_number:
                    measure = m
                    break
            
            if not measure:
                continue
            
            # Get the note
            notes = list(measure.notes)
            if note_index >= len(notes):
                continue
            
            # Get the note to update
            note_obj = notes[note_index]
            
            # Skip if it's a rest
            if note_obj.isRest:
                continue
            
            # Create new pitch string
            pitch_str = new_pitch
            if accidental:
                if accidental == "sharp":
                    pitch_str += "#"
                elif accidental == "flat":
                    pitch_str += "-"
            
            # Apply the octave if provided
            if octave is not None:
                # Create a new note with the updated pitch
                new_note = note.Note(pitch_str + str(octave))
            else:
                # Keep the same octave
                new_note = note.Note(pitch_str + str(note_obj.pitch.octave))
            
            # Copy duration and other attributes
            new_note.duration = note_obj.duration
            
            # Replace the note
            measure.replace(note_obj, new_note)
        
        # Write the updated score back to the file
        score.write('musicxml', fp=str(file_path))
        
        # Generate a new ID for the edited version
        import os
        edited_file_id = f"{file_id}_edited_{os.urandom(2).hex()}"
        edited_file_path = TEMP_DIR / f"{edited_file_id}.musicxml"
        
        # Save as a new file with _edited suffix
        score.write('musicxml', fp=str(edited_file_path))
        
        return {
            "status": "success", 
            "message": "MusicXML updated successfully",
            "original_file_id": file_id,
            "edited_file_id": edited_file_id
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating MusicXML: {str(e)}")

@router.get("/files/{file_id}")
async def get_file(file_id: str, type: str = Query(None)):
    """
    Download a file by ID with file type specified as a query parameter.
    
    Args:
        file_id: ID of the file to download
        type: Type of file to download (musicxml or pdf)
        
    Returns:
        FileResponse: The requested file
    """
    if not type or type not in ["musicxml", "pdf"]:
        raise HTTPException(status_code=400, detail="Invalid or missing file type")
    
    file_path = TEMP_DIR / f"{file_id}.{type}"
    
    if not file_path.exists():
        if type == "pdf":
            raise HTTPException(status_code=404, detail="PDF file could not be generated. Please download the MusicXML file instead.")
        else:
            raise HTTPException(status_code=404, detail="File not found")
    
    filename = f"sheet_music.{type}"
    media_type = "application/pdf" if type == "pdf" else "application/xml"
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )

@router.delete("/files/{file_id}")
async def delete_files(file_id: str):
    """
    Delete all files associated with a conversion.
    
    Args:
        file_id: ID of the files to delete
        
    Returns:
        dict: Status message
    """
    deleted_files = []
    
    for ext in ["wav", "musicxml", "pdf", "wav"]:
        file_path = TEMP_DIR / f"{file_id}.{ext}"
        if file_path.exists():
            file_path.unlink()
            deleted_files.append(str(file_path))
    
    return {"message": "Files deleted", "deleted_files": deleted_files}

@router.get("/check-files/{file_id}")
async def check_files(file_id: str):
    """
    Check which files are available for a given file ID.
    
    Args:
        file_id: ID of the files to check
        
    Returns:
        dict: Available files
    """
    available_files = {}
    
    for ext in ["musicxml", "pdf", "wav"]:
        file_path = TEMP_DIR / f"{file_id}.{ext}"
        available_files[ext] = file_path.exists()
    
    return available_files

@router.get("/files/{file_id}/view")
async def view_file(file_id: str, type: str = Query(default="pdf")):
    """
    View a file by ID with file type specified as a query parameter.
    Returns the file with appropriate headers for inline viewing.
    
    Args:
        file_id: ID of the file to view
        type: Type of file to view (musicxml or pdf), defaults to pdf
        
    Returns:
        FileResponse: The requested file for viewing
    """
    if type not in ["musicxml", "pdf"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    file_path = TEMP_DIR / f"{file_id}.{type}"
    
    if not file_path.exists():
        if type == "pdf":
            raise HTTPException(status_code=404, detail="PDF file could not be generated. Please download the MusicXML file instead.")
        else:
            raise HTTPException(status_code=404, detail="File not found")
    
    media_type = "application/pdf" if type == "pdf" else "application/xml"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*"
        }
    )
