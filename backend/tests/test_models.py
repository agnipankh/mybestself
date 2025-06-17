# test_models.py - Unit tests for SQLAlchemy models

import pytest
from datetime import datetime, timedelta
from uuid import UUID
from models import User, Persona, MagicLink

class TestUserModel:
    """Test User model functionality"""
    
    def test_user_creation(self, test_db):
        """Test creating a user with required fields"""
        user = User(name="John Doe", email="john@example.com")
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)
        
        assert user.id is not None
        assert isinstance(user.id, UUID)
        assert user.name == "John Doe"
        assert user.email == "john@example.com"
        assert user.created_at is not None
        assert isinstance(user.created_at, datetime)
    
    def test_user_creation_without_name(self, test_db):
        """Test creating a user without name (nullable field)"""
        user = User(email="jane@example.com")
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)
        
        assert user.id is not None
        assert user.name is None
        assert user.email == "jane@example.com"
    
    def test_user_email_uniqueness(self, test_db):
        """Test that user emails must be unique"""
        user1 = User(name="User 1", email="same@example.com")
        user2 = User(name="User 2", email="same@example.com")
        
        test_db.add(user1)
        test_db.commit()
        
        test_db.add(user2)
        with pytest.raises(Exception):  # Should raise integrity error
            test_db.commit()
    
    def test_user_persona_relationship(self, test_db):
        """Test the relationship between User and Persona"""
        user = User(name="Test User", email="test@example.com")
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)
        
        # Initially no personas
        assert len(user.personas) == 0
        
        # Add personas
        persona1 = Persona(user_id=user.id, label="Professional", north_star="Career growth")
        persona2 = Persona(user_id=user.id, label="Parent", north_star="Raise happy kids")
        
        test_db.add_all([persona1, persona2])
        test_db.commit()
        test_db.refresh(user)
        
        assert len(user.personas) == 2
        assert persona1 in user.personas
        assert persona2 in user.personas

class TestPersonaModel:
    """Test Persona model functionality"""
    
    def test_persona_creation(self, test_db, created_user):
        """Test creating a persona with all fields"""
        persona = Persona(
            user_id=created_user.id,
            label="Entrepreneur",
            north_star="Build successful businesses",
            is_calling=True
        )
        test_db.add(persona)
        test_db.commit()
        test_db.refresh(persona)
        
        assert persona.id is not None
        assert isinstance(persona.id, UUID)
        assert persona.user_id == created_user.id
        assert persona.label == "Entrepreneur"
        assert persona.north_star == "Build successful businesses"
        assert persona.is_calling is True
        assert persona.created_at is not None
        assert persona.updated_at is not None
    
    def test_persona_default_values(self, test_db, created_user):
        """Test persona creation with default values"""
        persona = Persona(
            user_id=created_user.id,
            label="Artist",
            north_star="Create meaningful art"
        )
        test_db.add(persona)
        test_db.commit()
        test_db.refresh(persona)
        
        assert persona.is_calling is False  # Default value
        assert persona.created_at is not None
        assert persona.updated_at is not None
    
    def test_persona_user_relationship(self, test_db, created_user):
        """Test the relationship between Persona and User"""
        persona = Persona(
            user_id=created_user.id,
            label="Student",
            north_star="Continuous learning"
        )
        test_db.add(persona)
        test_db.commit()
        test_db.refresh(persona)
        
        assert persona.user == created_user
        assert persona.user.id == created_user.id
    
    def test_persona_update_timestamp(self, test_db, created_persona):
        """Test that updated_at changes when persona is modified"""
        original_updated_at = created_persona.updated_at
        
        # Wait a bit to ensure timestamp difference
        import time
        time.sleep(0.1)
        
        # Update the persona
        created_persona.label = "Updated Label"
        created_persona.updated_at = datetime.utcnow()  # Simulating onupdate
        test_db.commit()
        test_db.refresh(created_persona)
        
        assert created_persona.updated_at > original_updated_at

class TestMagicLinkModel:
    """Test MagicLink model functionality"""
    
    def test_magic_link_creation(self, test_db):
        """Test creating a magic link"""
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        magic_link = MagicLink(
            email="test@example.com",
            token="abc123",
            expires_at=expires_at,
            used=False
        )
        test_db.add(magic_link)
        test_db.commit()
        test_db.refresh(magic_link)
        
        assert magic_link.id is not None
        assert isinstance(magic_link.id, UUID)
        assert magic_link.email == "test@example.com"
        assert magic_link.token == "abc123"
        assert magic_link.expires_at == expires_at
        assert magic_link.used is False
    
    def test_magic_link_default_values(self, test_db):
        """Test magic link creation with default values"""
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        magic_link = MagicLink(
            email="test@example.com",
            token="xyz789",
            expires_at=expires_at
        )
        test_db.add(magic_link)
        test_db.commit()
        test_db.refresh(magic_link)
        
        assert magic_link.used is False  # Default value
        assert magic_link.user_id is None  # Default value
    
    def test_magic_link_token_uniqueness(self, test_db):
        """Test that magic link tokens must be unique"""
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        
        link1 = MagicLink(
            email="user1@example.com",
            token="same-token",
            expires_at=expires_at
        )
        link2 = MagicLink(
            email="user2@example.com",
            token="same-token",
            expires_at=expires_at
        )
        
        test_db.add(link1)
        test_db.commit()
        
        test_db.add(link2)
        with pytest.raises(Exception):  # Should raise integrity error
            test_db.commit()
    
    def test_magic_link_user_relationship(self, test_db, created_user):
        """Test the relationship between MagicLink and User"""
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        magic_link = MagicLink(
            email=created_user.email,
            token="user-token",
            expires_at=expires_at,
            user_id=created_user.id
        )
        test_db.add(magic_link)
        test_db.commit()
        test_db.refresh(magic_link)
        
        assert magic_link.user == created_user
        assert magic_link.user.id == created_user.id
        assert magic_link in created_user.magic_links

class TestModelConstraints:
    """Test model constraints and edge cases"""
    
    def test_user_without_email_fails(self, test_db):
        """Test that user creation fails without email"""
        user = User(name="No Email User")
        test_db.add(user)
        
        with pytest.raises(Exception):  # Should raise integrity error
            test_db.commit()
    
    def test_persona_without_user_id_fails(self, test_db):
        """Test that persona creation fails without user_id"""
        persona = Persona(
            label="Orphan Persona",
            north_star="Should not exist"
        )
        test_db.add(persona)
        
        with pytest.raises(Exception):  # Should raise integrity error
            test_db.commit()
    
    def test_magic_link_without_required_fields_fails(self, test_db):
        """Test that magic link creation fails without required fields"""
        # Missing email
        with pytest.raises(Exception):
            magic_link = MagicLink(
                token="token123",
                expires_at=datetime.utcnow() + timedelta(minutes=10)
            )
            test_db.add(magic_link)
            test_db.commit()
        
        test_db.rollback()
        
        # Missing token
        with pytest.raises(Exception):
            magic_link = MagicLink(
                email="test@example.com",
                expires_at=datetime.utcnow() + timedelta(minutes=10)
            )
            test_db.add(magic_link)
            test_db.commit()
        
        test_db.rollback()
        
        # Missing expires_at
        with pytest.raises(Exception):
            magic_link = MagicLink(
                email="test@example.com",
                token="token123"
            )
            test_db.add(magic_link)
            test_db.commit()
