"""
Online media conversion endpoints (YouTube, Spotify).
"""

import os
import tempfile
import shutil
import subprocess
import logging
import ffmpeg
import yt_dlp
from pathlib import Path
from typing import Optional
from sqlmodel import Session
from fastapi import APIRouter, Depends, HTTPException, Response

from models.schemas import ConversionResult, YouTubeUrl, SpotifyUrl, GenericUrl
from models.auth import User
from models.score import ScoreGeneration, ScoreGenerationCreate
from db.config import get_session
from routers.auth import get_optional_user
from config import TEMP_DIR, SOUNDFONT_PATH
from wav_to_sheet_music import wav_to_sheet_music
from musicxml_to_wav import musicxml_to_wav
from utils import get_youtube_cookies_path
from utils.cleanup import cleanup_temp_directory, cleanup_file_by_id

# Get logger
from utils.logger import get_logger
logger = get_logger(__name__)

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
        youtube_data: The YouTube URL to process with optional max_duration
        
    Returns:
        ConversionResult: File ID and status message
    """
    url = youtube_data.url
    title = youtube_data.title
    max_duration = youtube_data.max_duration or 20  # Use provided duration or default to 20 seconds
    
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
            'cookiefile': get_youtube_cookies_path(),  # Use cookies file to bypass bot protection
            # Rate limiting to avoid triggering YouTube's anti-bot mechanisms
            'ratelimit': 200 * 1024,  # 200K/s limit
            'sleep_interval': 2,     # Sleep 2 seconds between requests
            'sleep_interval_requests': 5,  # Sleep after every 5 requests
            'verbose': True,  # Enable verbose output for debugging
            # Extract audio only (equivalent to -x option)
            'extract_audio': True,
            'audio_format': 'wav',  # Convert directly to WAV format
            'audio_quality': '0',   # Highest quality (0-9, 0 is best)
            # Download only the first max_duration seconds (correct time range syntax)
            # 'download_sections': f'*0-{max_duration}', # this is unreliable because youtube server doesn't always have accurate timestamps API error: 500 "{\"detail\":\"YouTube conversion failed: \\u001b[0;31mERROR:\\u001b[0m \\r[download] Got error: 1556480 bytes read, 228995 more expected\"}"
            # 'force_keyframes_at_cuts': True,  # Ensure accurate cuts
        }
        
        # Variable to store the original audio duration
        original_duration = None
        
        # Download audio from YouTube
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # Extract the original duration if available
            original_duration = info.get('duration')
            if original_duration:
                logger.info(f"Original YouTube video duration: {original_duration} seconds")
            
            # If title wasn't provided, use the video title
            if not title:
                title = info.get('title', 'YouTube Audio')
            
            # Get the downloaded file path - this should already be a WAV file
            downloaded_file = temp_dir / f"download.{info.get('ext', 'wav')}"
            
            # Check if the file exists and get its duration
            if downloaded_file.exists():
                try:
                    # Use FFprobe to get duration of the downloaded file
                    result = subprocess.run([
                        'ffprobe', 
                        '-v', 'error', 
                        '-show_entries', 'format=duration', 
                        '-of', 'default=noprint_wrappers=1:nokey=1', 
                        str(downloaded_file)
                    ], capture_output=True, text=True, check=True)
                    
                    downloaded_duration = float(result.stdout.strip())
                    logger.info(f"Downloaded file duration: {downloaded_duration} seconds")
                    
                    # Create a temporary file for the trimmed audio
                    trimmed_file = temp_dir / "trimmed.wav"
                    
                    # Use FFmpeg to trim the audio to max_duration
                    logger.info(f"Trimming audio to {max_duration} seconds")
                    subprocess.run([
                        'ffmpeg',
                        '-i', str(downloaded_file),
                        '-t', str(max_duration),
                        '-ar', '44100',
                        '-ac', '2',
                        '-acodec', 'pcm_s16le',
                        str(trimmed_file),
                        '-y',
                        '-loglevel', 'error'
                    ], check=True)
                    
                    # If trimming was successful, copy to wav_path
                    if trimmed_file.exists():
                        shutil.copy(trimmed_file, wav_path)
                        logger.info(f"Successfully trimmed WAV file to {max_duration} seconds: {wav_path}")
                        
                        # Get trimmed file duration for verification
                        result = subprocess.run([
                            'ffprobe', 
                            '-v', 'error', 
                            '-show_entries', 'format=duration', 
                            '-of', 'default=noprint_wrappers=1:nokey=1', 
                            str(wav_path)
                        ], capture_output=True, text=True, check=True)
                        
                        trimmed_duration = float(result.stdout.strip())
                        logger.info(f"Final trimmed file duration: {trimmed_duration} seconds")
                    else:
                        raise Exception("Failed to trim audio file")
                        
                except Exception as e:
                    logger.error(f"Error processing audio: {str(e)}")
                    # If trimming fails, use the original file (but this might be very long)
                    shutil.copy(downloaded_file, wav_path)
                    logger.info(f"Using original downloaded WAV file: {wav_path}")
            else:
                logger.error(f"Downloaded file not found at: {downloaded_file}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to download audio from YouTube."
                )
        
        # Clean up downloaded files except the WAV we need
        for file in temp_dir.glob("*"):
            if file != wav_path and file.exists():
                file.unlink()
        
        # Convert WAV to sheet music
        success = wav_to_sheet_music(
            str(wav_path),
            str(musicxml_path),
            title=title,
            output_pdf=str(pdf_path),
            messy=True
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
        
        # Create score generation record (with or without user)
        score_data = ScoreGenerationCreate(
            title=title,
            file_id=file_id,
            youtube_url=url,
            thumbnail_url=None
        )
        
        # If user is authenticated, associate the score with the user
        user_id = current_user.id if current_user else None
        
        try:
            logger.info(f"Attempting to save score generation record for file_id: {file_id} from YouTube URL: {url}")
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
            logger.info(f"Successfully saved score generation record with ID: {db_score.id}")
        except Exception as e:
            logger.error(f"Database error when saving score generation record: {str(e)}")
            # Rollback the session to avoid leaving it in an inconsistent state
            session.rollback()
            # Log the full stack trace for debugging
            import traceback
            logger.error(f"Stack trace: {traceback.format_exc()}")
            # Continue execution without failing - just add a note to the message
            if not message.endswith(")"): 
                message += " (database record could not be saved)"
        
        # Clean up temporary directory since we already have the processed files
        cleanup_temp_directory(temp_dir)
        
        return ConversionResult(
            file_id=file_id,
            message=message,
            has_pdf=has_pdf,
            duration=original_duration
        )
    
    except Exception as e:
        # Clean up any generated files on error
        logger.error(f"YouTube conversion failed: {e}")
        
        # Clean up the temporary directory
        cleanup_temp_directory(temp_dir)
        
        # Delete any generated files with this ID
        cleanup_file_by_id(file_id)
        
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
        spotify_data: The Spotify URL to process with optional max_duration
        
    Returns:
        ConversionResult: File ID and status message
    """
    url = spotify_data.url
    title = spotify_data.title
    max_duration = spotify_data.max_duration or 20  # Use provided duration or default to 20 seconds
    
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
        
        # Variable to store the original audio duration
        original_duration = None

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
                '--cookie-file', get_youtube_cookies_path()  # Use cookies file to bypass YouTube bot protection
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Find the downloaded file (should be the only file in the temp directory)
            downloaded_files = list(temp_dir.glob('*.*'))
            if not downloaded_files:
                raise Exception("spotdl did not download any files")
            
            downloaded_file = downloaded_files[0]
            print(f"Downloaded file: {downloaded_file}")
            
            # Get the audio duration using ffprobe
            try:
                probe = ffmpeg.probe(str(downloaded_file))
                if 'format' in probe and 'duration' in probe['format']:
                    original_duration = float(probe['format']['duration'])
                    logger.info(f"Original Spotify track duration: {original_duration} seconds")
            except Exception as e:
                logger.warning(f"Could not get duration from audio file: {str(e)}")
            
            # If title wasn't provided, use the track title
            if not title:
                title = downloaded_file.stem
            
            # Convert to WAV using ffmpeg
            try:
                # Try using the ffmpeg-python library
                ffmpeg.input(str(downloaded_file)).output(
                    str(wav_path), 
                    ar=44100,    # Audio sample rate
                    ac=2,        # Stereo audio
                    acodec='pcm_s16le',  # 16-bit PCM encoding for WAV
                    t=max_duration         # Limit to specified seconds
                ).overwrite_output().run(quiet=True, capture_stdout=True, capture_stderr=True)
                
                print(f"Converted {downloaded_file} to WAV: {wav_path}")
                logger.info(f"Created {max_duration}-second WAV clip from Spotify audio: {wav_path}")
            except Exception as e:
                # If the ffmpeg-python library fails, fall back to subprocess if ffmpeg is available
                print(f"FFmpeg-python error: {str(e)}")
                try:
                    subprocess.run([
                        'ffmpeg', '-i', str(downloaded_file), 
                        '-ar', '44100', '-ac', '2', 
                        '-acodec', 'pcm_s16le',
                        '-t', str(max_duration),  # Limit to specified seconds
                        str(wav_path),
                        '-y', '-loglevel', 'error'
                    ], check=True)
                    
                    print(f"Converted {downloaded_file} to WAV: {wav_path}")
                    logger.info(f"Created {max_duration}-second WAV clip from Spotify audio using subprocess: {wav_path}")
                except Exception as sub_e:
                    raise HTTPException(
                        status_code=500,
                        detail=f"FFmpeg conversion failed: {str(sub_e)}"
                    )
            
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
            output_pdf=str(pdf_path),
            messy=True
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
        
        try:
            logger.info(f"Attempting to save score generation record for file_id: {file_id} from Spotify URL: {url}")
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
            logger.info(f"Successfully saved score generation record with ID: {db_score.id}")
        except Exception as e:
            logger.error(f"Database error when saving score generation record: {str(e)}")
            # Rollback the session to avoid leaving it in an inconsistent state
            session.rollback()
            # Log the full stack trace for debugging
            import traceback
            logger.error(f"Stack trace: {traceback.format_exc()}")
            # Continue execution without failing - just add a note to the message
            if not message.endswith(")"): 
                message += " (database record could not be saved)"
        
        # Clean up temporary directory since we already have the processed files
        cleanup_temp_directory(temp_dir)
        
        return ConversionResult(
            file_id=file_id,
            message=message,
            has_pdf=has_pdf,
            duration=original_duration
        )
    
    except Exception as e:
        # Clean up any generated files on error
        logger.error(f"Spotify conversion failed: {e}")
        
        # Clean up the temporary directory
        cleanup_temp_directory(temp_dir)
        
        # Delete any generated files with this ID
        cleanup_file_by_id(file_id)
        
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
 
    url = url_data.url
    title = url_data.title
    max_duration = url_data.max_duration
    
    logger.info(f"Processing URL: {url}")
    logger.info(f"Max duration set to: {max_duration} seconds")
    
    try:
        # Auto-detect URL type
        if "youtube.com" in url or "youtu.be" in url or "music.youtube.com" in url:
            # Handle as YouTube URL
            logger.info(f"Detected YouTube URL, creating YouTubeUrl object with max_duration={max_duration}")
            youtube_data = YouTubeUrl(url=url, title=title, max_duration=max_duration)
            return await convert_youtube(youtube_data, current_user, session)
        elif "spotify.com/track/" in url or "spotify:track:" in url:
            # Handle as Spotify URL
            logger.info(f"Detected Spotify URL, creating SpotifyUrl object with max_duration={max_duration}")
            spotify_data = SpotifyUrl(url=url, title=title, max_duration=max_duration)
            return await convert_spotify(spotify_data, current_user, session)
        else:
            # Unknown URL type
            logger.error(f"Unsupported URL format: {url}")
            raise HTTPException(
                status_code=400,
                detail="Unsupported URL format. Please provide a valid YouTube or Spotify URL."
            )
    except Exception as e:
        # Log detailed error information
        logger.error(f"Error in convert_url endpoint: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        # Re-raise as HTTP exception with detailed message
        if isinstance(e, HTTPException):
            raise e
        else:
            raise HTTPException(
                status_code=500,
                detail=f"URL conversion failed: {str(e)}"
            )
