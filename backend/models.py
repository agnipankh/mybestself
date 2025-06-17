# models.py

from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID
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


class MagicLink(Base):
    __tablename__ = 'magic_links'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)         # ✅ UUID   
    email = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    user = relationship("User", back_populates="magic_links")

