"""Authentication and user registration routes.

This module provides endpoints for obtaining access tokens (POST /login) and
registering new users (POST /register). These handlers interact directly
with the users collection via a MongoDB adapter.
"""

import os
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from src.auth import create_access_token, get_password_hash, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES
from src.models.user import Token, UserCreate, User
from src.utils.adapter_factory import AdapterFactory

router = APIRouter()

# Get registration key from env
REGISTRATION_KEY = os.getenv("REGISTRATION_KEY", "admin_secret_key")

@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
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
async def register_user(user: UserCreate):
    if user.registration_key != REGISTRATION_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid registration key",
        )
    
    mongo_adapter = AdapterFactory.create_mongodb_adapter()
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
