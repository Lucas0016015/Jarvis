"""Authentication endpoints: register, login, refresh token."""
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger

from backend.core.auth import (
    Token,
    UserCreate,
    UserLogin,
    hash_password,
    verify_password,
    create_tokens_for_user,
    decode_token,
    get_current_user,
)
from backend.core.audit import audit_log, AuditAction

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Simple in-memory user store (replace with database in production) ──
_users_db: dict[str, dict] = {}


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user and return JWT tokens."""
    # Check if user exists
    if user_data.username in _users_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    # Hash password and store user
    hashed_pw = hash_password(user_data.password)
    _users_db[user_data.username] = {
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_pw,
        "created_at": "now",  # Use datetime.utcnow().isoformat() in production
    }

    logger.info(f"User registered: {user_data.username}")
    audit_log(
        action=AuditAction.CREATE,
        resource="user",
        user_id=user_data.username,
        details={"email": user_data.email},
    )

    return create_tokens_for_user(user_data.username)


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login and get JWT tokens."""
    user = _users_db.get(credentials.username)
    if not user or not verify_password(credentials.password, user["password"]):
        logger.warning(f"Failed login attempt for: {credentials.username}")
        audit_log(
            action=AuditAction.LOGIN,
            resource="auth",
            user_id=credentials.username,
            success=False,
            error_message="Invalid credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info(f"User logged in: {credentials.username}")
    audit_log(
        action=AuditAction.LOGIN,
        resource="auth",
        user_id=credentials.username,
        success=True,
    )

    return create_tokens_for_user(credentials.username)


@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """Refresh access token using a valid refresh token."""
    # The get_current_user dependency already validated the token
    user_id = current_user.get("sub")
    return create_tokens_for_user(user_id)


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    user_id = current_user.get("sub")
    user = _users_db.get(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return {
        "username": user["username"],
        "email": user["email"],
    }


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout (client should discard tokens)."""
    user_id = current_user.get("sub")
    logger.info(f"User logged out: {user_id}")
    audit_log(
        action=AuditAction.LOGOUT,
        resource="auth",
        user_id=user_id,
        success=True,
    )
    return {"message": "Logged out successfully. Discard your tokens."}
