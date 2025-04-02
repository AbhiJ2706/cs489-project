"""
File operations endpoints.
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response

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
