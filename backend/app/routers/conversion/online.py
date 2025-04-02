"""
Online media conversion endpoints (YouTube, Spotify).
"""

import os
import shutil
import subprocess
from pathlib import Path
import ffmpeg
import yt_dlp
from fastapi import APIRouter, HTTPException, Depends, status, Response
from sqlmodel import Session
from typing import Optional

from app.models.schemas import ConversionResult, YouTubeUrl, SpotifyUrl, GenericUrl
from app.models.auth import User
from app.models.score import ScoreGeneration, ScoreGenerationCreate
from app.db.config import get_session
from app.routers.auth import get_optional_user
from app.config import TEMP_DIR, SOUNDFONT_PATH
from app.wav_to_sheet_music import wav_to_sheet_music
from app.musicxml_to_wav import musicxml_to_wav

router = APIRouter(tags=["conversion"])

@router.post("/convert-youtube", response_model=ConversionResult)
async def convert_youtube(
    youtube_data: YouTubeUrl,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
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
            'cookiesfrombrowser': ('firefox', None, None, None),  # Use Firefox cookies to bypass bot protection
        }
        
        # Download audio from YouTube
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # If title wasn't provided, use the video title
            if not title:
                title = info.get('title', 'YouTube Audio')
            
            # Get the downloaded file path
            downloaded_file = temp_dir / f"download.{info.get('ext', 'webm')}"
            
            # Check if ffmpeg is available in the system
            ffmpeg_available = True
            try:
                # Try to run a simple ffmpeg command to check if it's installed
                subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
            except (subprocess.SubprocessError, FileNotFoundError):
                ffmpeg_available = False
                print("Warning: ffmpeg executable not found in PATH")
                raise HTTPException(
                    status_code=500,
                    detail="FFmpeg is not installed. Please install FFmpeg to use YouTube conversion."
                )
                
            # Convert to WAV using ffmpeg
            try:
                # First try using the ffmpeg-python library
                ffmpeg.input(str(downloaded_file)).output(
                    str(wav_path), 
                    ar=44100,  # Audio sample rate
                    ac=2,      # Stereo audio
                    acodec='pcm_s16le'  # 16-bit PCM encoding for WAV
                ).overwrite_output().run(quiet=True, capture_stdout=True, capture_stderr=True)
            except Exception as e:
                # If the ffmpeg-python library fails, fall back to subprocess if ffmpeg is available
                print(f"FFmpeg-python error: {str(e)}")
                if ffmpeg_available:
                    subprocess.run([
                        'ffmpeg', '-i', str(downloaded_file), 
                        '-ar', '44100', '-ac', '2', 
                        '-acodec', 'pcm_s16le', str(wav_path),
                        '-y', '-loglevel', 'error'
                    ], check=True)
                else:
                    raise HTTPException(
                        status_code=500,
                        detail="FFmpeg is not installed. Please install FFmpeg to use YouTube conversion."
                    )
        
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
        
        # Extract thumbnail URL from YouTube video if available
        thumbnail_url = None
        try:
            with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                thumbnails = info.get('thumbnails', [])
                if thumbnails:
                    # Get the highest quality thumbnail
                    thumbnails.sort(key=lambda x: x.get('height', 0) * x.get('width', 0), reverse=True)
                    thumbnail_url = thumbnails[0].get('url')
        except Exception as e:
            print(f"Error extracting thumbnail: {str(e)}")
        
        # Create score generation record (with or without user)
        score_data = ScoreGenerationCreate(
            title=title,
            file_id=file_id,
            youtube_url=url,
            thumbnail_url=thumbnail_url
        )
        
        # If user is authenticated, associate the score with the user
        user_id = current_user.id if current_user else None
        
        db_score = ScoreGeneration(
            title=score_data.title,
            file_id=score_data.file_id,
            youtube_url=score_data.youtube_url,
            thumbnail_url=score_data.thumbnail_url,
            user_id=user_id
        )
        
        session.add(db_score)
        session.commit()
        session.refresh(db_score)
        
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

@router.post("/convert-spotify", response_model=ConversionResult)
async def convert_spotify(
    spotify_data: SpotifyUrl,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
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
                '--output', download_output_path,
                '--cookies-from-browser', 'firefox'  # Use Firefox cookies to bypass YouTube bot protection
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
        
        # Create score generation record (with or without user)
        score_data = ScoreGenerationCreate(
            title=title,
            file_id=file_id,
            youtube_url=None,  # Not from YouTube
            thumbnail_url=None  # Spotify doesn't provide thumbnails in the same way
        )
        
        # If user is authenticated, associate the score with the user
        user_id = current_user.id if current_user else None
        
        db_score = ScoreGeneration(
            title=score_data.title,
            file_id=score_data.file_id,
            youtube_url=score_data.youtube_url,
            thumbnail_url=score_data.thumbnail_url,
            user_id=user_id
        )
        
        session.add(db_score)
        session.commit()
        session.refresh(db_score)
        
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

@router.post("/convert-url", response_model=ConversionResult)
async def convert_url(
    url_data: GenericUrl,
    response: Response,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
    """
    Auto-detect URL type (YouTube or Spotify) and process accordingly.
    
    Args:
        url_data: The URL to process and optional title
        
    Returns:
        ConversionResult: File ID and status message
    """
    # Add CORS headers explicitly
    # response.headers["Access-Control-Allow-Origin"] = "*"
    # response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    # response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    
    url = url_data.url
    title = url_data.title
    
    # Auto-detect URL type
    if "youtube.com" in url or "youtu.be" in url or "music.youtube.com" in url:
        # Handle as YouTube URL
        youtube_data = YouTubeUrl(url=url, title=title)
        return await convert_youtube(youtube_data, current_user, session)
    elif "spotify.com/track/" in url or "spotify:track:" in url:
        # Handle as Spotify URL
        spotify_data = SpotifyUrl(url=url, title=title)
        return await convert_spotify(spotify_data, current_user, session)
    else:
        # Unknown URL type
        raise HTTPException(
            status_code=400,
            detail="Unsupported URL format. Please provide a valid YouTube or Spotify URL."
        )
