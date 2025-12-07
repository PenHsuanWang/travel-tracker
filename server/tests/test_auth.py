import pytest
from datetime import timedelta
from jose import jwt
from fastapi import HTTPException
from unittest.mock import MagicMock, patch
from src import auth
from src.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    SECRET_KEY,
    ALGORITHM
)
from src.utils.adapter_factory import AdapterFactory

def test_password_hashing():
    password = "secret"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong", hashed) is False

def test_create_access_token():
    data = {"sub": "user1"}
    token = create_access_token(data)
    
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "user1"
    assert "exp" in payload

def test_create_access_token_expiry():
    data = {"sub": "user1"}
    expires = timedelta(minutes=1)
    token = create_access_token(data, expires_delta=expires)
    
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    # Check roughly
    import time
    assert payload["exp"] > time.time()

@pytest.mark.anyio
async def test_get_current_user_success(mock_mongodb_adapter):
    # Setup user
    user_doc = {
        "username": "testuser",
        "hashed_password": "hash",
        "email": "test@example.com"
    }
    mock_mongodb_adapter.save_data("user1", user_doc, collection_name='users')
    
    token = create_access_token({"sub": "testuser"})
    
    # We need to ensure get_current_user uses our mock adapter
    # The fixture mock_mongodb_adapter already patches AdapterFactory.create_mongodb_adapter
    
    user = await get_current_user(token)
    assert user.username == "testuser"

@pytest.mark.anyio
async def test_get_current_user_invalid_token():
    with pytest.raises(HTTPException) as exc:
        await get_current_user("invalid.token")
    assert exc.value.status_code == 401

@pytest.mark.anyio
async def test_get_current_user_missing_user(mock_mongodb_adapter):
    token = create_access_token({"sub": "missing_user"})
    
    with pytest.raises(HTTPException) as exc:
        await get_current_user(token)
    assert exc.value.status_code == 401

