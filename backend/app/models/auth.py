"""
Authentication models for the application.
"""
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, Relationship
from pydantic import EmailStr

from models.base import BaseModel

if TYPE_CHECKING:
    from models.score import ScoreGeneration

class User(BaseModel, table=True):
    """User model for authentication."""
    email: EmailStr = Field(unique=True, index=True)
    name: str
    profile_image: Optional[str] = None
    google_id: str = Field(unique=True, index=True)
    
    # Relationships
    score_generations: List["models.score.ScoreGeneration"] = Relationship(back_populates="user", sa_relationship_kwargs={"lazy": "selectin"})
