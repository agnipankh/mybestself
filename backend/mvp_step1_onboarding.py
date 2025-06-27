# Fixed FastAPI Backend - mvp_step1_onboarding.py

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db import SessionLocal, init_db
from models import User, Persona, Conversation, Goal
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

class GoalCreate(BaseModel):
    user_id: UUID
    persona_id: Optional[UUID] = None
    name: str
    acceptance_criteria: Optional[str] = None
    review_date: datetime

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    review_date: Optional[datetime] = None
    status: Optional[str] = None
    success_percentage: Optional[int] = None
    review_notes: Optional[str] = None




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
    user_id: str
    conversation_type: str
    topic: str
    tags: List[str] = []

class MessageAdd(BaseModel):
    from_role: str  # 'user' or 'coach'
    text: str

class ConversationComplete(BaseModel):
    key_insights: List[str]
    summary: Optional[str] = None

class ConversationTagsUpdate(BaseModel):
    add_tags: Optional[List[str]] = None
    remove_tags: Optional[List[str]] = None
    tags: Optional[List[str]] = None  # For complete replacement


@app.post("/conversations/")
def create_conversation(conversation: ConversationCreate, db: Session = Depends(get_db)):
    """Create a new conversation (user-centric, no persona required)"""
    # Validate user exists
    user = db.get(User, conversation.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create conversation without persona_id
    db_conversation = Conversation(
        user_id=conversation.user_id,
        conversation_type=conversation.conversation_type,
        topic=conversation.topic,
        tags=conversation.tags,
        messages=[],
        key_insights=[],
        status='active'
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
    conversation = db.get(Conversation, conversation_id)
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
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.status = 'completed'
    conversation.key_insights = completion.key_insights
    conversation.conversation_summary = completion.summary
    conversation.ended_at = datetime.utcnow()
    
    db.commit()
    return conversation

@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Get a specific conversation by ID"""
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@app.patch("/conversations/{conversation_id}/tags")
def update_conversation_tags(
    conversation_id: str,
    tag_update: ConversationTagsUpdate,
    db: Session = Depends(get_db)
):
    """Add, remove, or replace tags on a conversation"""
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    current_tags = conversation.tags or []
    
    if tag_update.tags is not None:
        # Complete replacement
        conversation.tags = tag_update.tags
    else:
        # Incremental updates
        new_tags = set(current_tags)
        
        if tag_update.add_tags:
            new_tags.update(tag_update.add_tags)
        
        if tag_update.remove_tags:
            new_tags.difference_update(tag_update.remove_tags)
        
        conversation.tags = list(new_tags)
    
    conversation.last_activity_at = datetime.utcnow()
    db.commit()
    db.refresh(conversation)
    return conversation

@app.get("/users/{user_id}/conversations")
def get_user_conversations(
    user_id: str,
    conversation_type: Optional[str] = None,
    tag: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    db: Session = Depends(get_db)
):
    """
    Get conversations for a user with flexible filtering
    
    Args:
        user_id: UUID of the user
        conversation_type: Filter by type ('discovery', 'refinement', 'decision_making', etc.)
        tag: Filter by tag (e.g., 'Professional', 'Creative', 'goal-setting')
        limit: Maximum number of conversations to return
        offset: Number of conversations to skip (for pagination)
        db: Database session
        
    Returns:
        List of conversations matching the filters
    """
    # Validate user exists
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build the base query
    query = db.query(Conversation).filter_by(user_id=user_id)
    
    # Apply conversation_type filter
    if conversation_type:
        query = query.filter(Conversation.conversation_type == conversation_type)
    
    # Apply tag filter using PostgreSQL array operations
    if tag:
        # Use PostgreSQL's array contains operator
        # This checks if the tag exists anywhere in the tags array
        query = query.filter(Conversation.tags.any(tag))
    
    # Order by most recent first
    query = query.order_by(Conversation.last_activity_at.desc())
    
    # Apply pagination
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    
    # Execute query and return results
    conversations = query.all()
    
    return {
        "conversations": conversations,
        "total_count": len(conversations),
        "filters_applied": {
            "user_id": user_id,
            "conversation_type": conversation_type,
            "tag": tag,
            "limit": limit,
            "offset": offset
        }
    }

# Additional helper endpoints for common use cases
@app.get("/users/{user_id}/conversations/discovery")
def get_discovery_conversations(
    user_id: str, 
    limit: Optional[int] = 10,
    db: Session = Depends(get_db)
):
    """Shorthand endpoint for discovery conversations"""
    return get_user_conversations(
        user_id=user_id,
        conversation_type="discovery",
        limit=limit,
        db=db
    )

@app.get("/users/{user_id}/conversations/by-persona/{persona_name}")
def get_conversations_by_persona_name(
    user_id: str,
    persona_name: str,
    limit: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get conversations that discuss a specific persona by name"""
    return get_user_conversations(
        user_id=user_id,
        tag=persona_name,
        limit=limit,
        db=db
    )

@app.get("/users/{user_id}/conversations/search")
def search_conversations(
    user_id: str,
    q: str,  # search query
    conversation_type: Optional[str] = None,
    limit: Optional[int] = 20,
    db: Session = Depends(get_db)
):
    """
    Search conversations by content, topic, or tags
    
    Args:
        user_id: UUID of the user
        q: Search query (searches in topic, tags, and message content)
        conversation_type: Optional filter by conversation type
        limit: Maximum results to return
    """
    from sqlalchemy import func
    
    # Validate user exists
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build search query
    query = db.query(Conversation).filter_by(user_id=user_id)
    
    # Apply conversation_type filter if provided
    if conversation_type:
        query = query.filter(Conversation.conversation_type == conversation_type)
    
    # Search in multiple fields using PostgreSQL text search
    search_filter = (
        # Search in topic
        Conversation.topic.ilike(f"%{q}%") |
        # Search in tags array (convert to text and search)
        func.array_to_string(Conversation.tags, ' ').ilike(f"%{q}%") |
        # Search in conversation summary
        Conversation.conversation_summary.ilike(f"%{q}%")
        # Note: Removed messages search for now as it's more complex with JSONB
    )
    
    query = query.filter(search_filter)
    
    # Order by relevance (most recent first for now)
    query = query.order_by(Conversation.last_activity_at.desc())
    
    if limit:
        query = query.limit(limit)
    
    conversations = query.all()
    
    return {
        "conversations": conversations,
        "search_query": q,
        "total_results": len(conversations),
        "conversation_type_filter": conversation_type
    }



# ============================================
# GOAL ROUTES
# ============================================

@app.post("/goals/")
def create_goal(goal: GoalCreate, db: Session = Depends(get_db)):
    """Create a new goal, optionally for a persona"""
    # Validate user exists
    user = db.get(User, goal.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate persona exists if persona_id is provided
    if goal.persona_id is not None:
        persona = db.get(Persona, goal.persona_id)
        if not persona:
            raise HTTPException(status_code=404, detail="Persona not found")
        # Ensure persona belongs to the same user
        if persona.user_id != goal.user_id:
            raise HTTPException(status_code=400, detail="Persona does not belong to the specified user")
    
    db_goal = Goal(
        user_id=goal.user_id,
        persona_id=goal.persona_id,
        name=goal.name,
        acceptance_criteria=goal.acceptance_criteria,
        review_date=goal.review_date
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@app.get("/personas/{persona_id}/goals")
def list_persona_goals(persona_id: UUID, db: Session = Depends(get_db)):
    """Get all goals for a specific persona"""
    persona = db.get(Persona, persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona.goals

@app.get("/goals/{goal_id}")
def get_goal(goal_id: UUID, db: Session = Depends(get_db)):
    """Get a specific goal by ID"""
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal

@app.put("/goals/{goal_id}")
def update_goal(goal_id: UUID, goal_update: GoalUpdate, db: Session = Depends(get_db)):
    """Update an existing goal"""
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Update only the fields that were provided
    if goal_update.name is not None:
        goal.name = goal_update.name
    if goal_update.acceptance_criteria is not None:
        goal.acceptance_criteria = goal_update.acceptance_criteria
    if goal_update.review_date is not None:
        goal.review_date = goal_update.review_date
    if goal_update.status is not None:
        goal.status = goal_update.status
    if goal_update.success_percentage is not None:
        # Validate percentage is between 0-100
        if not (0 <= goal_update.success_percentage <= 100):
            raise HTTPException(status_code=400, detail="Success percentage must be between 0 and 100")
        goal.success_percentage = goal_update.success_percentage
    if goal_update.review_notes is not None:
        goal.review_notes = goal_update.review_notes
    
    db.commit()
    db.refresh(goal)
    return goal

@app.delete("/goals/{goal_id}")
def delete_goal(goal_id: UUID, db: Session = Depends(get_db)):
    """Delete a goal by its ID"""
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.delete(goal)
    db.commit()
    return {"message": f"Goal '{goal.name}' deleted successfully"}

@app.get("/users/{user_id}/goals")
def list_user_goals(user_id: UUID, db: Session = Depends(get_db)):
    """Get all goals for a user, both with and without personas"""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Now we can directly access all goals for this user via the relationship
    return user.goals

@app.get("/users/{user_id}/goals/due")
def get_goals_due_for_review(user_id: UUID, db: Session = Depends(get_db)):
    """Get all goals that are due for review (review_date <= today)"""
    from datetime import date
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    today = date.today()
    due_goals = []
    
    # Check all user goals (both with and without personas)
    for goal in user.goals:
        if goal.review_date.date() <= today and goal.status == 'active':
            due_goals.append(goal)
    
    return due_goals

# Include auth router
from email_magic_link_auth import router as auth_router
app.include_router(auth_router)
