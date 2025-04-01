"""
Home endpoint for the DaScore API.
"""

from fastapi import APIRouter

router = APIRouter(tags=["home"])

@router.get("/")
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
