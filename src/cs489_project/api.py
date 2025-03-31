"""
FastAPI backend for WAV to Sheet Music conversion.
"""

import os
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from wav_to_sheet_music import wav_to_sheet_music
from musicxml_to_wav import musicxml_to_wav
import music21

# Create temporary directory for storing files
TEMP_DIR = Path(tempfile.gettempdir()) / "audio_converter"
TEMP_DIR.mkdir(exist_ok=True)

# Get the absolute path to the project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent.absolute()
SOUNDFONT_PATH = PROJECT_ROOT / "FluidR3_GM.sf2"

# Configure music21 to use a different PDF backend if MuseScore is not available
try:
    # Try to use MuseScore
    music21.environment.set("musicxmlPath", "musescore")
    music21.environment.set("pdfPath", "musescore")
except:
    # Fallback to Lilypond if available
    try:
        music21.environment.set("lilypondPath", "lilypond")
    except:
        # If neither is available, we'll handle this in the conversion function
        pass

app = FastAPI(title="DaScore API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConversionResult(BaseModel):
    """Model for conversion result response."""
    file_id: str
    message: str
    has_pdf: bool = False

@app.post("/convert", response_model=ConversionResult)
async def convert_audio(file: UploadFile = File(...), title: Optional[str] = None):
    """
    Convert uploaded WAV file to sheet music (MusicXML and PDF).
    
    Args:
        file: The WAV file to convert
        title: Optional title for the sheet music
        
    Returns:
        ConversionResult: File ID and status message
    """
    # Validate file type
    if not file.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="Only WAV files are supported")
    
    # Create unique file paths
    file_id = f"{os.urandom(4).hex()}"
    wav_path = TEMP_DIR / f"{file_id}.wav"
    musicxml_path = TEMP_DIR / f"{file_id}.musicxml"
    pdf_path = TEMP_DIR / f"{file_id}.pdf"
    
    try:
        # Save uploaded file
        with open(wav_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Use the title from the filename if not provided
        if not title:
            title = os.path.splitext(file.filename)[0]
        
        # Convert WAV to sheet music
        success = wav_to_sheet_music(
            str(wav_path),
            str(musicxml_path),
            title=title,
            output_pdf=str(pdf_path)
        )
        
        # Check if conversion was successful for MusicXML
        if not success or not musicxml_path.exists():
            raise HTTPException(
                status_code=500, 
                detail="Conversion failed. Please try a different audio file."
            )
        
        # Check if PDF was generated
        has_pdf = pdf_path.exists()
        
        # If PDF generation failed but MusicXML succeeded, we can still return success
        message = "Conversion successful"
        if not has_pdf:
            message += " (PDF generation failed, but MusicXML is available)"
        
        return ConversionResult(
            file_id=file_id,
            message=message,
            has_pdf=has_pdf
        )
    
    except Exception as e:
        # Clean up any created files
        for path in [wav_path, musicxml_path, pdf_path]:
            if path.exists():
                path.unlink()
        
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}"
        )

@app.get("/download/{file_type}/{file_id}")
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

@app.get("/preview/{file_id}")
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
        media_type="application/pdf"
    )

@app.get("/musicxml-content/{file_id}")
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

@app.get("/synthesize/{file_id}")
async def synthesize_audio(file_id: str, background_tasks: BackgroundTasks):
    """
    Convert MusicXML to WAV audio for playback.
    
    Args:
        file_id: ID of the MusicXML file to convert
        
    Returns:
        dict: Status and audio URL for the frontend
    """
    musicxml_path = TEMP_DIR / f"{file_id}.musicxml"
    wav_path = TEMP_DIR / f"{file_id}_synthesized.wav"
    
    if not musicxml_path.exists():
        raise HTTPException(status_code=404, detail="MusicXML file not found")
    
    # Check if synthesized audio already exists
    if not wav_path.exists():
        # Convert MusicXML to WAV
        success = musicxml_to_wav(
            str(musicxml_path), 
            str(wav_path),
            soundfont_path=str(SOUNDFONT_PATH)  # Pass the absolute path to the soundfont
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to synthesize audio from MusicXML"
            )
    
    return {
        "status": "success",
        "audio_url": f"/audio/{file_id}"
    }

@app.get("/audio/{file_id}")
async def get_audio(file_id: str):
    """
    Stream the synthesized audio file.
    
    Args:
        file_id: ID of the audio file
        
    Returns:
        FileResponse: The audio file
    """
    wav_path = TEMP_DIR / f"{file_id}_synthesized.wav"
    
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail="Synthesized audio not found")
    
    return FileResponse(
        path=wav_path,
        media_type="audio/wav",
        filename="synthesized_sheet_music.wav"
    )

@app.get("/check-files/{file_id}")
async def check_files(file_id: str):
    """
    Check which files are available for a given file ID.
    
    Args:
        file_id: ID of the files to check
        
    Returns:
        dict: Available files
    """
    available_files = {}
    
    for ext in ["musicxml", "pdf"]:
        file_path = TEMP_DIR / f"{file_id}.{ext}"
        available_files[ext] = file_path.exists()
    
    return available_files

@app.delete("/files/{file_id}")
async def delete_files(file_id: str):
    """
    Delete all files associated with a conversion.
    
    Args:
        file_id: ID of the files to delete
        
    Returns:
        dict: Status message
    """
    deleted_files = []
    
    for ext in ["wav", "musicxml", "pdf"]:
        file_path = TEMP_DIR / f"{file_id}.{ext}"
        if file_path.exists():
            file_path.unlink()
            deleted_files.append(str(file_path))
    
    return {"message": "Files deleted", "deleted_files": deleted_files}

def run_server():
    """Run the FastAPI server."""
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    run_server()