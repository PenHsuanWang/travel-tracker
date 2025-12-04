"""Authentication endpoints for login and controlled registration."""

from __future__ import annotations

import os
from datetime import timedelta
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from src.auth import ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token, get_password_hash, verify_password
from src.models.user import Token, User, UserCreate
from src.services.service_dependencies import ensure_storage_manager
from src.utils.dbbutler.mongodb_adapter import MongoDBAdapter
from src.utils.dbbutler.storage_manager import StorageManager

router = APIRouter()


@lru_cache
def _storage_manager() -> StorageManager:
    return ensure_storage_manager(include_mongodb=True)


def get_mongo_adapter() -> MongoDBAdapter:
    """Provide a cached Mongo adapter."""

    manager = _storage_manager()
    adapter = manager.adapters.get("mongodb")
    if not adapter:
        raise RuntimeError("MongoDB adapter not configured")
    return adapter  # type: ignore[return-value]

# Get registration key from env
REGISTRATION_KEY = os.getenv("REGISTRATION_KEY", "admin_secret_key")

@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
):
    """Authenticate a user using username/password and return a JWT."""
    users_collection = mongo_adapter.get_collection("users")
    
    user_data = users_collection.find_one({"username": form_data.username})
    
    # Mitigate timing attacks by always performing password verification
    if user_data:
        password_valid = verify_password(form_data.password, user_data["hashed_password"])
    else:
        # Verify against a dummy hash to simulate work (prevents username enumeration)
        # This is a valid bcrypt hash for "password"
        dummy_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J.fGqGZ9y"
        verify_password(form_data.password, dummy_hash)
        password_valid = False
    
    if not user_data or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data["username"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(
    user: UserCreate,
    mongo_adapter: MongoDBAdapter = Depends(get_mongo_adapter),
):
    if user.registration_key != REGISTRATION_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid registration key",
        )
    
    users_collection = mongo_adapter.get_collection("users")
    
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    
    hashed_password = get_password_hash(user.password)
    user_in_db = {
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "hashed_password": hashed_password
    }
    
    # We let MongoDB generate the _id
    result = users_collection.insert_one(user_in_db)
    
    return user
