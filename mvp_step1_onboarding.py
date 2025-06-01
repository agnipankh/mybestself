# FastAPI Backend for MVP with SQLAlchemy + Postgres

from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db import SessionLocal, init_db
from models import User, Persona

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

@app.get("/users/{user_id}/personas")
def list_personas(user_id: str, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.personas

