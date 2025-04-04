"""
Authentication router for Google sign-in.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.utils import get_authorization_scheme_param
from sqlmodel import Session, select
from jose import JWTError, jwt
from pydantic import BaseModel

from db.config import get_session
from models.auth import User

# JWT configuration
SECRET_KEY = "your-secret-key-here"  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2 schemes
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Custom bearer token scheme that makes the token optional
class OptionalHTTPBearer(HTTPBearer):
    def __init__(self, auto_error: bool = False):
        super().__init__(auto_error=auto_error)
        
    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        authorization = request.headers.get("Authorization")
        if not authorization:
            return None
            
        scheme, credentials = get_authorization_scheme_param(authorization)
        if not (scheme and credentials):
            return None
            
        if scheme.lower() != "bearer":
            return None
            
        return HTTPAuthorizationCredentials(scheme=scheme, credentials=credentials)

optional_oauth2_scheme = OptionalHTTPBearer(auto_error=False)

# Router
router = APIRouter(prefix="/auth", tags=["auth"])

# Token models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    token: str
    name: str
    email: str
    profile_image: Optional[str] = None
    google_id: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    """Get the current user from the JWT token.
    
    This function requires authentication and will raise an exception if the token is invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = session.exec(select(User).where(User.email == token_data.email)).first()
    if user is None:
        raise credentials_exception
    return user

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_oauth2_scheme), session: Session = Depends(get_session)):
    """Get the current user from the JWT token if available.
    
    This function makes authentication optional. It will return None if no token is provided
    or if the token is invalid, instead of raising an exception.
    """
    if credentials is None:
        return None
        
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        token_data = TokenData(email=email)
    except JWTError:
        return None
    
    user = session.exec(select(User).where(User.email == token_data.email)).first()
    return user

@router.post("/google-signin", response_model=Token)
async def google_signin(auth_data: GoogleAuthRequest, session: Session = Depends(get_session)):
    """Sign in or sign up with Google."""
    # Check if user exists
    user = session.exec(select(User).where(User.google_id == auth_data.google_id)).first()
    
    if not user:
        # Create new user
        user = User(
            email=auth_data.email,
            name=auth_data.name,
            profile_image=auth_data.profile_image,
            google_id=auth_data.google_id
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user
