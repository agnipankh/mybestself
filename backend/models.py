# models.py

from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
import uuid
from uuid import uuid4


Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    personas = relationship("Persona", back_populates="user")
    magic_links = relationship("MagicLink", back_populates="user")

class PersonaConversation(Base):
    __tablename__ = "persona_conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey('personas.id'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    
    # Conversation metadata
    discussion_type = Column(String)     # 'clarification', 'importance', etc.
    topic = Column(String)               # "Exploring Creative persona meaning"
    status = Column(String, default='active')  # 'active', 'completed'
    
    # Full conversation as JSON
    messages = Column(JSONB, default=list)  # Array of message objects
    
    # Insights from the conversation
    key_insights = Column(ARRAY(String), default=list)
    conversation_summary = Column(Text)
    
    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    
    user = relationship("User")
    persona = relationship("Persona", back_populates="conversations")


class Persona(Base):
    __tablename__ = "personas"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)          # ✅ UUID
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False) 
    label = Column(String)
    north_star = Column(String)
    is_calling = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # Add this
    
    user = relationship("User", back_populates="personas")
    conversations = relationship("PersonaConversation", back_populates="persona")


class MagicLink(Base):
    __tablename__ = 'magic_links'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)         # ✅ UUID   
    email = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    user = relationship("User", back_populates="magic_links")

