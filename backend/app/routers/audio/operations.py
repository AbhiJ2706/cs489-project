"""
Audio operations endpoints.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from config import TEMP_DIR, SOUNDFONT_PATH
from musicxml_to_wav import musicxml_to_wav

router = APIRouter(tags=["audio"])

@router.get("/synthesize/{file_id}")
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

@router.get("/audio/{file_id}")
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

@router.get("/uploads/{file_id}")
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
