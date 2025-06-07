# email_magic_link_auth.py

import uuid
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText

from fastapi import FastAPI, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from db import SessionLocal, init_db
from models import MagicLink, User  # You need to define MagicLink in your models.py

from fastapi import APIRouter
router = APIRouter()

# Create magic link table on startup
@router.on_event("startup")
def startup():
    init_db()

# Dependency

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Config
APP_URL = "http://localhost:3000"
SMTP_HOST = "localhost"
SMTP_PORT = 1025  # Mailpit's SMTP port
FROM_EMAIL = "no-reply@mybestself.app"

# Request model
class EmailRequest(BaseModel):
    email: EmailStr

# 1. Request a magic link
@router.post("/auth/request")
def request_magic_link(payload: EmailRequest, db: Session = Depends(get_db)):
    token = str(uuid.uuid4())
    expires = datetime.utcnow() + timedelta(minutes=10)

    # Store token
    link = MagicLink(
        email=payload.email,
        token=token,
        expires_at=expires,
        used=False,
    )
    db.add(link)
    db.commit()

    # Email body
    link_url = f"{APP_URL}/login?token={token}"
    body = f"Click the link to sign in: {link_url}\n\nLink expires in 10 minutes."
    msg = MIMEText(body)
    msg["Subject"] = "Your MyBestSelf Login Link"
    msg["From"] = FROM_EMAIL
    msg["To"] = payload.email

    # Send email
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.sendmail(FROM_EMAIL, [payload.email], msg.as_string())

    return {"message": "Magic link sent"}

# 2. Verify a magic link
@router.get("/auth/verify")
def verify_magic_link(token: str, db: Session = Depends(get_db)):
    link = db.query(MagicLink).filter_by(token=token, used=False).first()
    if not link:
        raise HTTPException(status_code=404, detail="Invalid or used token")
    if link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    # Create user if not exist
    user = db.query(User).filter_by(email=link.email).first()
    if not user:
        user = User(email=link.email)
        db.add(user)

    link.used = True
    db.commit()

    return {"message": "Authentication successful", "user_id": user.id}

