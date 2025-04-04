"""
Score generation models for the application.
"""
from typing import Optional, List, TYPE_CHECKING, Any
from sqlmodel import Field, Relationship, SQLModel
from pydantic import HttpUrl
from datetime import datetime

from models.base import BaseModel

# Import User at runtime to avoid circular import issues
from models.auth import User

class ScoreGeneration(BaseModel, table=True):
    """Model for storing score sheet generations."""
    title: str
    file_id: str = Field(unique=True, index=True)
    youtube_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    
    # Foreign keys
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    # Relationships
    user: Optional["app.models.auth.User"] = Relationship(back_populates="score_generations", sa_relationship_kwargs={"lazy": "selectin"})
    
class ScoreGenerationCreate(SQLModel):
    """Schema for creating a score generation."""
    title: str
    file_id: str
    youtube_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    
class ScoreGenerationRead(SQLModel):
    """Schema for reading a score generation."""
    id: int
    title: str
    file_id: str
    youtube_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime
    user_id: Optional[int] = None
