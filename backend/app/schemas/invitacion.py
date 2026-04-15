from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class InvitacionCreate(BaseModel):
    email: EmailStr
    full_name: str
    rol: UserRole


class InvitacionOut(BaseModel):
    id: str
    tenant_id: str
    email: str
    full_name: str
    rol: UserRole
    usado: bool
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
