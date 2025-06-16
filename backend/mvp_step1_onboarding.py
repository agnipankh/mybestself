# FastAPI Backend for MVP with SQLAlchemy + Postgres

from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db import SessionLocal, init_db
from models import User, Persona
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import datetime
from uuid import UUID

app = FastAPI()

# Initialize DB on startup
@app.on_event("startup")
def startup():
    init_db()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schemas
class UserCreate(BaseModel):
    name: str
    email: str

class PersonaCreate(BaseModel):
    user_id: str
    label: str
    north_star: str
    is_calling: bool = False

# Routes
@app.post("/users/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = User(name=user.name, email=user.email)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/personas/")
def create_persona(persona: PersonaCreate, db: Session = Depends(get_db)):
    db_user = db.get(User, persona.user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db_persona = Persona(
        user_id=persona.user_id,
        label=persona.label,
        north_star=persona.north_star,
        is_calling=persona.is_calling
    )
    db.add(db_persona)
    db.commit()
    db.refresh(db_persona)
    return db_persona

@app.delete("/personas/")
def delete_persona(user_id: str, label: str, db: Session = Depends(get_db)):
    persona = db.query(Persona).filter_by(user_id=user_id, label=label).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    db.delete(persona)
    db.commit()
    return {"message": f"Persona '{label}' deleted for user {user_id}"}


class PersonaUpdate(BaseModel):
    label: Optional[str] = None
    north_star: Optional[str] = None
    is_calling: Optional[bool] = None


@app.put("/personas/{persona_id}")
def update_persona(persona_id: str, persona_update: PersonaUpdate, db: Session = Depends(get_db)):
    """Update an existing persona"""
    persona = db.get(Persona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    # Update only the fields that were provided
    if persona_update.label is not None:
        persona.label = persona_update.label
    if persona_update.north_star is not None:
        persona.north_star = persona_update.north_star
    if persona_update.is_calling is not None:
        persona.is_calling = persona_update.is_calling
    
    # Update the timestamp (you'll need to add this field to your Persona model)
    persona.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(persona)
    return persona

@app.get("/users/{user_id}/personas")
def list_personas(user_id: str, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.personas

from email_magic_link_auth import router as auth_router
app.include_router(auth_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


