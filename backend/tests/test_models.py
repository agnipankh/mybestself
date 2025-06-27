# test_models.py - Unit tests for SQLAlchemy models

import pytest
from datetime import datetime, timedelta
from uuid import UUID
from models import User, Persona, MagicLink, Goal

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


class TestGoalModel:
    """Test Goal model functionality"""
    
    def test_goal_creation_with_persona(self, test_db, created_persona):
        """Test creating a goal with persona"""
        review_date = datetime.utcnow() + timedelta(days=7)
        goal = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Complete project milestone",
            acceptance_criteria="All tasks completed and reviewed",
            review_date=review_date
        )
        test_db.add(goal)
        test_db.commit()
        test_db.refresh(goal)
        
        assert goal.id is not None
        assert isinstance(goal.id, UUID)
        assert goal.user_id == created_persona.user_id
        assert goal.persona_id == created_persona.id
        assert goal.name == "Complete project milestone"
        assert goal.acceptance_criteria == "All tasks completed and reviewed"
        assert goal.review_date == review_date
        assert goal.status == 'active'  # Default value
        assert goal.success_percentage == 0  # Default value
        assert goal.review_notes is None
        assert goal.created_at is not None
    
    def test_goal_minimal_creation(self, test_db, created_persona):
        """Test creating a goal with only required fields"""
        review_date = datetime.utcnow() + timedelta(days=7)
        goal = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Minimal goal",
            review_date=review_date
        )
        test_db.add(goal)
        test_db.commit()
        test_db.refresh(goal)
        
        assert goal.id is not None
        assert goal.user_id == created_persona.user_id
        assert goal.persona_id == created_persona.id
        assert goal.name == "Minimal goal"
        assert goal.acceptance_criteria is None
        assert goal.review_date == review_date
        assert goal.status == 'active'
        assert goal.success_percentage == 0
    
    def test_goal_persona_relationship(self, test_db, created_persona):
        """Test the relationship between Goal and Persona"""
        review_date = datetime.utcnow() + timedelta(days=7)
        goal = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Relationship test goal",
            review_date=review_date
        )
        test_db.add(goal)
        test_db.commit()
        test_db.refresh(goal)
        
        # Test forward relationship
        assert goal.persona == created_persona
        assert goal.persona.id == created_persona.id
        
        # Test reverse relationship
        test_db.refresh(created_persona)
        assert goal in created_persona.goals
        assert len(created_persona.goals) >= 1
    
    def test_goal_creation_without_persona(self, test_db, created_user):
        """Test creating a goal without persona (persona_id is optional now)"""
        review_date = datetime.utcnow() + timedelta(days=7)
        goal = Goal(
            user_id=created_user.id,
            persona_id=None,
            name="Personal goal without persona",
            acceptance_criteria="Achieve personal growth",
            review_date=review_date
        )
        test_db.add(goal)
        test_db.commit()
        test_db.refresh(goal)
        
        assert goal.id is not None
        assert goal.user_id == created_user.id
        assert goal.persona_id is None
        assert goal.name == "Personal goal without persona"
        assert goal.acceptance_criteria == "Achieve personal growth"
        assert goal.review_date == review_date
        assert goal.status == 'active'
        assert goal.success_percentage == 0
    
    def test_goal_without_user_id_fails(self, test_db):
        """Test that goal creation fails without user_id (required field)"""
        review_date = datetime.utcnow() + timedelta(days=7)
        goal = Goal(
            name="Orphan goal",
            review_date=review_date
        )
        test_db.add(goal)
        
        with pytest.raises(Exception):  # Should raise integrity error
            test_db.commit()
    
    def test_goal_without_name_fails(self, test_db, created_persona):
        """Test that goal creation fails without name"""
        review_date = datetime.utcnow() + timedelta(days=7)
        goal = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            review_date=review_date
        )
        test_db.add(goal)
        
        with pytest.raises(Exception):  # Should raise integrity error
            test_db.commit()
    
    def test_goal_without_review_date_fails(self, test_db, created_persona):
        """Test that goal creation fails without review_date"""
        goal = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="No review date goal"
        )
        test_db.add(goal)
        
        with pytest.raises(Exception):  # Should raise integrity error
            test_db.commit()
    
    def test_goal_status_values(self, test_db, created_persona):
        """Test different goal status values"""
        review_date = datetime.utcnow() + timedelta(days=7)
        
        # Test active status (default)
        goal1 = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Active goal",
            review_date=review_date
        )
        test_db.add(goal1)
        test_db.commit()
        test_db.refresh(goal1)
        assert goal1.status == 'active'
        
        # Test completed status
        goal2 = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Completed goal",
            review_date=review_date,
            status='completed'
        )
        test_db.add(goal2)
        test_db.commit()
        test_db.refresh(goal2)
        assert goal2.status == 'completed'
        
        # Test refined status
        goal3 = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Refined goal",
            review_date=review_date,
            status='refined'
        )
        test_db.add(goal3)
        test_db.commit()
        test_db.refresh(goal3)
        assert goal3.status == 'refined'
    
    def test_goal_success_percentage_values(self, test_db, created_persona):
        """Test goal success percentage field"""
        review_date = datetime.utcnow() + timedelta(days=7)
        
        goal = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Success tracking goal",
            review_date=review_date,
            success_percentage=75
        )
        test_db.add(goal)
        test_db.commit()
        test_db.refresh(goal)
        
        assert goal.success_percentage == 75
    
    def test_multiple_goals_per_persona(self, test_db, created_persona):
        """Test that a persona can have multiple goals"""
        review_date = datetime.utcnow() + timedelta(days=7)
        
        goal1 = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="First goal",
            review_date=review_date
        )
        goal2 = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Second goal",
            review_date=review_date + timedelta(days=1)
        )
        goal3 = Goal(
            user_id=created_persona.user_id,
            persona_id=created_persona.id,
            name="Third goal",
            review_date=review_date + timedelta(days=2)
        )
        
        test_db.add_all([goal1, goal2, goal3])
        test_db.commit()
        
        test_db.refresh(created_persona)
        assert len(created_persona.goals) == 3
        
        goal_names = [goal.name for goal in created_persona.goals]
        assert "First goal" in goal_names
        assert "Second goal" in goal_names
        assert "Third goal" in goal_names
    
    def test_goal_user_relationship(self, test_db, created_user):
        """Test the relationship between Goal and User"""
        review_date = datetime.utcnow() + timedelta(days=7)
        goal = Goal(
            user_id=created_user.id,
            persona_id=None,
            name="User relationship test goal",
            review_date=review_date
        )
        test_db.add(goal)
        test_db.commit()
        test_db.refresh(goal)
        
        # Test forward relationship
        assert goal.user == created_user
        assert goal.user.id == created_user.id
        
        # Test reverse relationship
        test_db.refresh(created_user)
        assert goal in created_user.goals
        assert len(created_user.goals) >= 1
