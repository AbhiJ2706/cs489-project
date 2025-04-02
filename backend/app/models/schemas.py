"""
Pydantic models for the DaScore API.
"""

from typing import Optional
from pydantic import BaseModel, Field

class ConversionResult(BaseModel):
    """Model for conversion result response."""
    file_id: str
    message: str
    has_pdf: bool = False
    duration: Optional[float] = None  # Duration of the source audio in seconds

class YouTubeUrl(BaseModel):
    """Model for YouTube URL input."""
    url: str
    title: Optional[str] = None
    max_duration: Optional[int] = Field(default=20, description="Maximum duration in seconds to extract from the audio (default: 20s)")

class SpotifyUrl(BaseModel):
    """Model for Spotify URL input."""
    url: str
    title: Optional[str] = None
    max_duration: Optional[int] = Field(default=20, description="Maximum duration in seconds to extract from the audio (default: 20s)")

class GenericUrl(BaseModel):
    """Model for generic URL input (YouTube or Spotify)."""
    url: str
    title: Optional[str] = None
    max_duration: Optional[int] = Field(default=20, description="Maximum duration in seconds to extract from the audio (default: 20s)")
