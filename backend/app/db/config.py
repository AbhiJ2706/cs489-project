"""
Database configuration for the application.
"""
import os
from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL from environment variable with fallback to a default for development
DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    default="postgresql://postgres:postgres@localhost:5432/dascore"
)

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL, 
    echo=True,  # Set to False in production
    pool_pre_ping=True
)

def create_db_and_tables():
    """Create database tables from SQLModel metadata."""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Get a database session."""
    with Session(engine) as session:
        yield session
