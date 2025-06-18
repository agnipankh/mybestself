# Fixed FastAPI Backend - mvp_step1_onboarding.py

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db import SessionLocal, init_db
from models import User, Persona, PersonaConversation
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from sqlalchemy.exc import IntegrityError

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

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
    user_id: UUID
    label: str
    north_star: str
    is_calling: bool = False

class PersonaUpdate(BaseModel):
    label: Optional[str] = None
    north_star: Optional[str] = None
    is_calling: Optional[bool] = None

# ============================================
# USER ROUTES
# ============================================

@app.post("/users/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        db_user = User(name=user.name, email=user.email)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError as e:
        db.rollback()
        if "email" in str(e.orig):
            raise HTTPException(
                status_code=409, 
                detail=f"User with email '{user.email}' already exists"
            )
        raise HTTPException(status_code=400, detail="Database constraint violation")

@app.get("/users/{user_id}")
def get_user(user_id: UUID, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============================================
# PERSONA ROUTES - RESTful Design
# ============================================

@app.post("/personas/")
def create_persona(persona: PersonaCreate, db: Session = Depends(get_db)):
    """Create a new persona"""
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
def list_user_personas(user_id: UUID, db: Session = Depends(get_db)):
    """Get all personas for a specific user"""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.personas

@app.get("/personas/{persona_id}")
def get_persona(persona_id: UUID, db: Session = Depends(get_db)):
    """Get a specific persona by ID"""
    persona = db.get(Persona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona

@app.put("/personas/{persona_id}")
def update_persona(persona_id: UUID, persona_update: PersonaUpdate, db: Session = Depends(get_db)):
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
    
    persona.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(persona)
    return persona

@app.delete("/personas/{persona_id}")
def delete_persona_by_id(persona_id: UUID, db: Session = Depends(get_db)):
    """Delete a persona by its ID (preferred method)"""
    persona = db.get(Persona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    db.delete(persona)
    db.commit()
    return {"message": f"Persona '{persona.label}' deleted successfully"}

# DEPRECATED: Keep for backward compatibility but move to better endpoint
@app.delete("/users/{user_id}/personas/{label}")
def delete_persona_by_label(user_id: UUID, label: str, db: Session = Depends(get_db)):
    """Delete a persona by user ID and label (legacy endpoint)"""
    persona = db.query(Persona).filter_by(user_id=user_id, label=label).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    db.delete(persona)
    db.commit()
    return {"message": f"Persona '{label}' deleted for user {user_id}"}

# ============================================
# CONVERSATION ROUTES
# ============================================

class ConversationCreate(BaseModel):
    persona_id: str
    discussion_type: str
    topic: str

class MessageAdd(BaseModel):
    from_role: str  # 'user' or 'coach'
    text: str

class ConversationComplete(BaseModel):
    key_insights: List[str]
    summary: Optional[str] = None

@app.post("/conversations/")
def create_conversation(conversation: ConversationCreate, db: Session = Depends(get_db)):
    """Start a new conversation about a persona"""
    persona = db.get(Persona, conversation.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    db_conversation = PersonaConversation(
        persona_id=conversation.persona_id,
        user_id=persona.user_id,
        discussion_type=conversation.discussion_type,
        topic=conversation.topic,
        messages=[],
        key_insights=[]
    )
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation

@app.post("/conversations/{conversation_id}/messages")
def add_message_to_conversation(
    conversation_id: str, 
    message: MessageAdd, 
    db: Session = Depends(get_db)
):
    """Add a message to an ongoing conversation"""
    conversation = db.get(PersonaConversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    current_messages = conversation.messages or []
    
    new_message = {
        "sequence": len(current_messages) + 1,
        "timestamp": datetime.utcnow().isoformat(),
        "from": message.from_role,
        "text": message.text
    }
    
    updated_messages = current_messages + [new_message]
    conversation.messages = updated_messages
    conversation.last_activity_at = datetime.utcnow()
    
    db.commit()
    return {"message": "Message added", "conversation": conversation}

@app.patch("/conversations/{conversation_id}/complete")
def complete_conversation(
    conversation_id: str,
    completion: ConversationComplete,
    db: Session = Depends(get_db)
):
    """Mark conversation as completed with insights"""
    conversation = db.get(PersonaConversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.status = 'completed'
    conversation.key_insights = completion.key_insights
    conversation.conversation_summary = completion.summary
    conversation.ended_at = datetime.utcnow()
    
    db.commit()
    return conversation

@app.get("/personas/{persona_id}/conversations")
def get_persona_conversations(persona_id: str, db: Session = Depends(get_db)):
    """Get all conversations for a persona"""
    conversations = db.query(PersonaConversation)\
        .filter_by(persona_id=persona_id)\
        .order_by(PersonaConversation.started_at.desc())\
        .all()
    return conversations

# Include auth router
from email_magic_link_auth import router as auth_router
app.include_router(auth_router)
