"""
Models package for the DaScore API.
"""

# Import models to expose them at the package level and for Alembic to discover
from models.base import BaseModel
from models.auth import User
from models.score import ScoreGeneration

# Import all your models here so Alembic can discover them
# Example: from app.models.some_model import SomeModel
