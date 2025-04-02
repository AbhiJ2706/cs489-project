"""
Base SQLModel models for the application.
"""
from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel

class BaseModel(SQLModel, table=False):
    """Base model for all models."""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)