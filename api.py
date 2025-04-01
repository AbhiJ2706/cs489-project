"""
FastAPI backend for WAV to Sheet Music conversion.
"""

import os
import sys
import time
import tempfile
import shutil
import subprocess
from typing import Optional, Dict, List, Union
from pathlib import Path
import ffmpeg
import yt_dlp
from music21 import environment
from pydantic import BaseModel
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Form, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask
from wav_to_sheet_music import wav_to_sheet_music
from musicxml_to_wav import musicxml_to_wav
import music21
import yt_dlp
import ffmpeg
import uvicorn

# Create temporary directory for storing files
TEMP_DIR = Path(tempfile.gettempdir()) / "audio_converter"
TEMP_DIR.mkdir(exist_ok=True)

# Get the absolute path to the project root directory
PROJECT_ROOT = Path(__file__).parent.absolute()
SOUNDFONT_PATH = PROJECT_ROOT / "FluidR3_GM.sf2"

# Output debugging information about soundfont
print(f"Soundfont path: {SOUNDFONT_PATH}")
print(f"Soundfont exists: {SOUNDFONT_PATH.exists()}")

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def home():
    """
    API home page.
    
    Returns:
        dict: Basic information about the API
    """
    return {
        "name": "DaScore API",
        "description": "Convert between WAV audio and sheet music (MusicXML/PDF)",
        "endpoints": {
            "POST /convert": "Convert WAV file to sheet music",
            "POST /convert-youtube": "Convert YouTube video audio to sheet music",
            "POST /convert-spotify": "Convert Spotify track audio to sheet music",
            "POST /convert-url": "Auto-detect URL type (YouTube or Spotify) and process accordingly",
            "GET /download/{file_type}/{file_id}": "Download a converted file",
            "GET /preview/{file_id}": "Preview PDF file",
            "GET /musicxml-content/{file_id}": "Get MusicXML content",
            "GET /synthesize/{file_id}": "Convert MusicXML to WAV audio",
            "GET /audio/{file_id}": "Stream synthesized audio file",
            "GET /uploads/{file_id}": "Stream original uploaded audio file",
            "GET /check-files/{file_id}": "Check which files are available for a given file ID",
            "DELETE /files/{file_id}": "Delete all files associated with a conversion"
        },
        "version": "1.0.0"
    }

class ConversionResult(BaseModel):
    """Model for conversion result response."""
    file_id: str
    message: str
    has_pdf: bool = False

class YouTubeUrl(BaseModel):
    """Model for YouTube URL input."""
    url: str
    title: Optional[str] = None

class SpotifyUrl(BaseModel):
    """Model for Spotify URL input."""
    url: str
    title: Optional[str] = None

class GenericUrl(BaseModel):
    """Model for generic URL input (YouTube or Spotify)."""
    url: str
    title: Optional[str] = None

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
        
        # Synthesize audio from the MusicXML
        synthesized_wav_path = TEMP_DIR / f"{file_id}_synthesized.wav"
        try:
            print(f"Attempting to synthesize audio for {file_id}")
            print(f"MusicXML path: {musicxml_path} (exists: {musicxml_path.exists()})")
            print(f"Output path: {synthesized_wav_path}")
            print(f"Using soundfont: {SOUNDFONT_PATH}")
            
            success = musicxml_to_wav(
                str(musicxml_path), 
                str(synthesized_wav_path),
                soundfont_path=str(SOUNDFONT_PATH)
            )
            
            if success:
                print(f"Audio synthesis successful, file saved to {synthesized_wav_path}")
                print(f"Synthesized file exists: {synthesized_wav_path.exists()}")
                print(f"Synthesized file size: {synthesized_wav_path.stat().st_size if synthesized_wav_path.exists() else 0} bytes")
            else:
                print("Warning: Failed to synthesize audio from MusicXML")
        except Exception as e:
            print(f"Error synthesizing audio: {str(e)}")
            import traceback
            traceback.print_exc()
        
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

@app.post("/convert-youtube", response_model=ConversionResult)
async def convert_youtube(youtube_data: YouTubeUrl):
    """
    Download audio from a YouTube URL, convert to WAV, and generate sheet music.
    
    Args:
        youtube_data: The YouTube URL to process
        
    Returns:
        ConversionResult: File ID and status message
    """
    url = youtube_data.url
    title = youtube_data.title
    
    # Create unique file ID and paths
    file_id = f"{os.urandom(4).hex()}"
    temp_dir = TEMP_DIR / file_id
    temp_dir.mkdir(exist_ok=True)
    
    wav_path = TEMP_DIR / f"{file_id}.wav"
    musicxml_path = TEMP_DIR / f"{file_id}.musicxml"
    pdf_path = TEMP_DIR / f"{file_id}.pdf"
    
    try:
        # Configure yt-dlp options
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(temp_dir / 'download.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
        }
        
        # Download audio from YouTube
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # If title wasn't provided, use the video title
            if not title:
                title = info.get('title', 'YouTube Audio')
            
            # Get the downloaded file path
            downloaded_file = temp_dir / f"download.{info.get('ext', 'webm')}"
            
            # Convert to WAV using ffmpeg
            try:
                ffmpeg.input(str(downloaded_file)).output(
                    str(wav_path), 
                    ar=44100,  # Audio sample rate
                    ac=2,      # Stereo audio
                    acodec='pcm_s16le'  # 16-bit PCM encoding for WAV
                ).overwrite_output().run(quiet=True, capture_stdout=True, capture_stderr=True)
            except ffmpeg.Error:
                # If the ffmpeg-python library fails, fall back to subprocess
                subprocess.run([
                    'ffmpeg', '-i', str(downloaded_file), 
                    '-ar', '44100', '-ac', '2', 
                    '-acodec', 'pcm_s16le', str(wav_path),
                    '-y', '-loglevel', 'error'
                ], check=True)
        
        # Clean up downloaded file
        if downloaded_file.exists():
            downloaded_file.unlink()
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        
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
                detail="Conversion failed. Please try a different YouTube video."
            )
        
        # Check if PDF was generated
        has_pdf = pdf_path.exists()
        
        # Synthesize audio from the MusicXML
        synthesized_wav_path = TEMP_DIR / f"{file_id}_synthesized.wav"
        try:
            print(f"Attempting to synthesize audio for {file_id}")
            print(f"MusicXML path: {musicxml_path} (exists: {musicxml_path.exists()})")
            print(f"Output path: {synthesized_wav_path}")
            print(f"Using soundfont: {SOUNDFONT_PATH}")
            
            success = musicxml_to_wav(
                str(musicxml_path), 
                str(synthesized_wav_path),
                soundfont_path=str(SOUNDFONT_PATH)
            )
            
            if success:
                print(f"Audio synthesis successful, file saved to {synthesized_wav_path}")
                print(f"Synthesized file exists: {synthesized_wav_path.exists()}")
                print(f"Synthesized file size: {synthesized_wav_path.stat().st_size if synthesized_wav_path.exists() else 0} bytes")
            else:
                print("Warning: Failed to synthesize audio from MusicXML")
        except Exception as e:
            print(f"Error synthesizing audio: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # If PDF generation failed but MusicXML succeeded, we can still return success
        message = "YouTube audio conversion successful"
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
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        
        raise HTTPException(
            status_code=500,
            detail=f"YouTube conversion failed: {str(e)}"
        )

@app.post("/convert-spotify", response_model=ConversionResult)
async def convert_spotify(spotify_data: SpotifyUrl):
    """
    Download audio from a Spotify URL, convert to WAV, and generate sheet music.
    
    Args:
        spotify_data: The Spotify URL to process
        
    Returns:
        ConversionResult: File ID and status message
    """
    url = spotify_data.url
    title = spotify_data.title
    
    # Create unique file ID and paths
    file_id = f"{os.urandom(4).hex()}"
    temp_dir = TEMP_DIR / file_id
    temp_dir.mkdir(exist_ok=True)
    
    wav_path = TEMP_DIR / f"{file_id}.wav"
    musicxml_path = TEMP_DIR / f"{file_id}.musicxml"
    pdf_path = TEMP_DIR / f"{file_id}.pdf"
    
    try:
        # Extract the Spotify track ID from the URL
        # URL format: https://open.spotify.com/track/1234567890
        if "spotify.com/track/" in url:
            track_id = url.split("spotify.com/track/")[1].split("?")[0]
        elif "spotify:track:" in url:
            track_id = url.split("spotify:track:")[1].split("?")[0]
        else:
            raise HTTPException(status_code=400, detail="Invalid Spotify URL. Please provide a link to a specific track.")

        # Check if spotdl is installed
        try:
            # Check if spotdl is installed by running a simple command
            subprocess.run(['spotdl', '--version'], check=True, capture_output=True)
        except (subprocess.SubprocessError, FileNotFoundError):
            # If spotdl is not installed or there's an error
            raise HTTPException(
                status_code=500,
                detail="The spotdl tool is not installed or not working properly. Please install it with 'pip install spotdl'."
            )
            
        # Use spotdl to download the track
        print(f"Attempting to download Spotify track: {track_id}")
        download_output_path = str(temp_dir)
        
        try:
            # Run spotdl command to download the track
            subprocess.run([
                'spotdl', 'download', f"https://open.spotify.com/track/{track_id}", 
                '--output', download_output_path
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Find the downloaded file (should be the only file in the temp directory)
            downloaded_files = list(temp_dir.glob('*.*'))
            if not downloaded_files:
                raise Exception("spotdl did not download any files")
            
            downloaded_file = downloaded_files[0]
            print(f"Downloaded file: {downloaded_file}")
            
            # If title wasn't provided, use the track title
            if not title:
                title = downloaded_file.stem
            
            # Convert to WAV using ffmpeg
            try:
                ffmpeg.input(str(downloaded_file)).output(
                    str(wav_path), 
                    ar=44100,  # Audio sample rate
                    ac=2,      # Stereo audio
                    acodec='pcm_s16le'  # 16-bit PCM encoding for WAV
                ).overwrite_output().run(quiet=True, capture_stdout=True, capture_stderr=True)
                
                print(f"Converted {downloaded_file} to WAV: {wav_path}")
                
            except ffmpeg.Error as e:
                # If the ffmpeg-python library fails, fall back to subprocess
                print(f"ffmpeg.Error: {str(e)}, falling back to subprocess")
                subprocess.run([
                    'ffmpeg', '-i', str(downloaded_file), 
                    '-ar', '44100', '-ac', '2', 
                    '-acodec', 'pcm_s16le', str(wav_path),
                    '-y', '-loglevel', 'error'
                ], check=True)
            
            # Clean up downloaded file
            if downloaded_file.exists():
                downloaded_file.unlink()
                
        except subprocess.CalledProcessError as e:
            print(f"Error running spotdl: {e.stderr.decode() if e.stderr else str(e)}")
            raise Exception(f"Failed to download Spotify track: {str(e)}")
        
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
                detail="Conversion failed. Please try a different Spotify track."
            )
        
        # Check if PDF was generated
        has_pdf = pdf_path.exists()
        
        # Synthesize audio from the MusicXML
        synthesized_wav_path = TEMP_DIR / f"{file_id}_synthesized.wav"
        try:
            print(f"Attempting to synthesize audio for {file_id}")
            print(f"MusicXML path: {musicxml_path} (exists: {musicxml_path.exists()})")
            print(f"Output path: {synthesized_wav_path}")
            print(f"Using soundfont: {SOUNDFONT_PATH}")
            
            success = musicxml_to_wav(
                str(musicxml_path), 
                str(synthesized_wav_path),
                soundfont_path=str(SOUNDFONT_PATH)
            )
            
            if success:
                print(f"Audio synthesis successful, file saved to {synthesized_wav_path}")
                print(f"Synthesized file exists: {synthesized_wav_path.exists()}")
                print(f"Synthesized file size: {synthesized_wav_path.stat().st_size if synthesized_wav_path.exists() else 0} bytes")
            else:
                print("Warning: Failed to synthesize audio from MusicXML")
        except Exception as e:
            print(f"Error synthesizing audio: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # If PDF generation failed but MusicXML succeeded, we can still return success
        message = "Spotify audio conversion successful"
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
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        
        raise HTTPException(
            status_code=500,
            detail=f"Spotify conversion failed: {str(e)}"
        )

@app.post("/convert-url", response_model=ConversionResult)
async def convert_url(url_data: GenericUrl):
    """
    Auto-detect URL type (YouTube or Spotify) and process accordingly.
    
    Args:
        url_data: The URL to process and optional title
        
    Returns:
        ConversionResult: File ID and status message
    """
    url = url_data.url
    title = url_data.title
    
    # Auto-detect URL type
    if "youtube.com" in url or "youtu.be" in url or "music.youtube.com" in url:
        # Handle as YouTube URL
        youtube_data = YouTubeUrl(url=url, title=title)
        return await convert_youtube(youtube_data)
    elif "spotify.com/track/" in url or "spotify:track:" in url:
        # Handle as Spotify URL
        spotify_data = SpotifyUrl(url=url, title=title)
        return await convert_spotify(spotify_data)
    else:
        # Unknown URL type
        raise HTTPException(
            status_code=400,
            detail="Unsupported URL format. Please provide a valid YouTube or Spotify URL."
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
async def synthesize_audio(file_id: str):
    """
    Synthesize audio from MusicXML to WAV.
    
    Args:
        file_id: ID of the MusicXML file
        
    Returns:
        dict: Status message
    """
    musicxml_path = TEMP_DIR / f"{file_id}.musicxml"
    wav_path = TEMP_DIR / f"{file_id}_synthesized.wav"
    
    # Check if MusicXML file exists
    if not musicxml_path.exists():
        raise HTTPException(status_code=404, detail="MusicXML file not found")
    
    # If synthesized audio already exists, don't regenerate it
    if wav_path.exists():
        return {"status": "success", "message": "Audio already synthesized"}
    
    try:
        # Convert MusicXML to WAV
        success = musicxml_to_wav(
            str(musicxml_path), 
            str(wav_path),
            soundfont_path=str(SOUNDFONT_PATH)
        )
        
        if not success:
            raise HTTPException(
                status_code=500, 
                detail="Failed to synthesize audio from MusicXML"
            )
        
        return {"status": "success", "message": "Audio synthesis complete"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error synthesizing audio: {str(e)}"
        )

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

@app.get("/uploads/{file_id}")
async def get_original_audio(file_id: str):
    """
    Stream the original uploaded audio file.
    
    Args:
        file_id: ID of the original audio file
        
    Returns:
        FileResponse: The original audio file
    """
    # Check for original uploaded file
    wav_path = TEMP_DIR / f"{file_id}.wav"
    
    if not wav_path.exists():
        raise HTTPException(status_code=404, detail="Original audio file not found")
    
    return FileResponse(
        path=wav_path,
        media_type="audio/wav",
        filename="original_audio.wav"
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
    
    for ext in ["musicxml", "pdf", "wav"]:
        file_path = TEMP_DIR / f"{file_id}.{ext}"
        available_files[ext] = file_path.exists()
    
    return available_files

@app.get("/files/{file_id}")
async def get_file(file_id: str, type: str = None):
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
    
    for ext in ["wav", "musicxml", "pdf", "wav"]:
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