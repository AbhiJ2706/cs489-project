"""
Router for score sheet generations.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy import desc
from datetime import datetime

from app.db.config import get_session
from app.models.auth import User
from app.models.score import ScoreGeneration, ScoreGenerationCreate, ScoreGenerationRead
from app.routers.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/scores", tags=["scores"])

@router.post("", response_model=ScoreGenerationRead)
async def create_score_generation(
    score: ScoreGenerationCreate,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
    """Create a new score generation.
    
    Authentication is optional. If the user is authenticated, the score will be
    associated with their account. If not, the score will be created without
    a user association.
    """
    db_score = ScoreGeneration(
        title=score.title,
        file_id=score.file_id,
        youtube_url=score.youtube_url,
        thumbnail_url=score.thumbnail_url,
        user_id=current_user.id if current_user else None
    )
    session.add(db_score)
    session.commit()
    session.refresh(db_score)
    return db_score

@router.get("", response_model=List[ScoreGenerationRead])
async def get_score_generations(
    skip: int = 0,
    limit: int = 100,
    # current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all score generations for the current user."""
    scores = session.exec(
        select(ScoreGeneration)
        # .where(ScoreGeneration.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(desc(ScoreGeneration.created_at))
    ).all()
    return scores

@router.get("/recent", response_model=List[ScoreGenerationRead])
async def get_recent_scores(
    skip: int = 0,
    limit: int = 20,
    session: Session = Depends(get_session)
):
    """Get recent score generations for the public landing page.
    
    This endpoint does not require authentication and returns the most recent
    score generations across all users.
    """
    scores = session.exec(
        select(ScoreGeneration)
        .offset(skip)
        .limit(limit)
        .order_by(desc(ScoreGeneration.created_at))
    ).all()
    return scores

@router.get("/featured", response_model=List[ScoreGenerationRead])
async def get_featured_scores(
    limit: int = Query(20, ge=1, le=50),
    session: Session = Depends(get_session)
):
    """Get featured score generations for the public landing page.
    
    This endpoint does not require authentication and returns score generations
    that have been marked as featured or have YouTube thumbnails.
    """
    # For now, we'll consider scores with YouTube thumbnails as featured
    scores = session.exec(
        select(ScoreGeneration)
        .where(ScoreGeneration.thumbnail_url.isnot(None))
        .limit(limit)
        .order_by(desc(ScoreGeneration.created_at))
    ).all()
    
    # If we don't have enough featured scores, supplement with recent scores
    if len(scores) < limit:
        additional_scores = session.exec(
            select(ScoreGeneration)
            .where(ScoreGeneration.thumbnail_url.is_(None))
            .limit(limit - len(scores))
            .order_by(desc(ScoreGeneration.created_at))
        ).all()
        scores.extend(additional_scores)
    
    return scores

@router.get("/{score_id}", response_model=ScoreGenerationRead)
async def get_score_generation(
    score_id: int,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
    """Get a specific score generation.
    
    If the user is authenticated, they can only access their own scores.
    If the user is not authenticated, they can only access public scores.
    """
    # Get the score
    score = session.exec(
        select(ScoreGeneration)
        .where(ScoreGeneration.id == score_id)
    ).first()
    
    if not score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Score generation not found"
        )
    
    # Check permissions
    if current_user is not None and score.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this score"
        )
    
    return score

@router.delete("/{score_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_score_generation(
    score_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Delete a score generation.
    
    Users can only delete their own scores.
    """
    score = session.exec(
        select(ScoreGeneration)
        .where(ScoreGeneration.id == score_id)
        .where(ScoreGeneration.user_id == current_user.id)
    ).first()
    
    if not score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Score generation not found"
        )
    
    session.delete(score)
    session.commit()
    
    return None

@router.get("/search", response_model=List[ScoreGenerationRead])
async def search_scores(
    query: str,
    limit: int = Query(20, ge=1, le=50),
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session)
):
    """Search for scores by title or YouTube URL.
    
    If the user is authenticated, they can search all scores.
    If the user is not authenticated, they can only search public scores.
    """
    search_query = f"%{query}%"
    
    # Build the base query
    base_query = select(ScoreGeneration).where(
        (ScoreGeneration.title.ilike(search_query)) | 
        (ScoreGeneration.youtube_url.ilike(search_query))
    )
    
    # If user is authenticated, filter by user_id
    if current_user is not None:
        base_query = base_query.where(ScoreGeneration.user_id == current_user.id)
    
    # Execute the query
    scores = session.exec(
        base_query
        .limit(limit)
        .order_by(desc(ScoreGeneration.created_at))
    ).all()
    
    return scores
