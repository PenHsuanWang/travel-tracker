from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class User(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None

class UserInDB(User):
    hashed_password: str

class UserCreate(User):
    password: str
    registration_key: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
