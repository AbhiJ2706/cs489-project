"""
Pydantic models for the DaScore API.
"""

from typing import Optional
from pydantic import BaseModel

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
