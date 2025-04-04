"""
Audio file conversion endpoints.
"""

import os
import shutil
import logging
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from fastapi.responses import FileResponse
from sqlmodel import Session

from models.schemas import ConversionResult
from models.auth import User
from models.score import ScoreGeneration, ScoreGenerationCreate
from db.config import get_session
from routers.auth import get_optional_user
from config import TEMP_DIR, SOUNDFONT_PATH
from wav_to_sheet_music import wav_to_sheet_music
from musicxml_to_wav import musicxml_to_wav

# Set up logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/convert", tags=["conversion"])

@router.post("", response_model=ConversionResult)
async def convert_audio(
    file: UploadFile = File(...), 
    title: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
    """
    Convert uploaded WAV file to sheet music (MusicXML and PDF).
    
    Args:
        file: The WAV file to convert
        title: Optional title for the sheet music
        
    Returns:
        ConversionResult: File ID and status message
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".wav"):
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
        if not title and file.filename:
            title = os.path.splitext(file.filename)[0]
        
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
            
        # Create score generation record (with or without user)
        score_data = ScoreGenerationCreate(
            title=title or "Untitled Score",
            file_id=file_id,
            youtube_url=None,  # Not from YouTube
            thumbnail_url=None  # No thumbnail for direct uploads
        )
        
        # If user is authenticated, associate the score with the user
        user_id = current_user.id if current_user else None
        
        try:
            logger.info(f"Attempting to save score generation record for file_id: {file_id}")
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
            # Continue execution without failing
            if not message.endswith(")"): 
                message += " (database record could not be saved)"
            
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
