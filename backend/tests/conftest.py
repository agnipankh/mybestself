# conftest.py - Test configuration and fixtures

import pytest
import os
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from uuid import uuid4

# Import your app components
from models import Base, User, Persona, MagicLink
from mvp_step1_onboarding import app, get_db
from email_magic_link_auth import router as auth_router

# Test database URL - using PostgreSQL to match production
TEST_DATABASE_URL = "postgresql+psycopg2://postgres:secret@localhost:5432/test_mvp_app"

@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine"""
    engine = create_engine(TEST_DATABASE_URL)
    
    # Create all tables
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
    
    yield engine
    
    # Clean up - drop all tables
    print("Dropping database tables...")
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function") 
def test_db(test_engine):
    """Create a fresh database session for each test"""
    # Force clean database before each test
    with test_engine.connect() as conn:
        trans = conn.begin()
        try:
            # Delete all data in dependency order (conversations depend on users)
            conn.execute(text("DELETE FROM goals"))
            conn.execute(text("DELETE FROM conversations"))
            conn.execute(text("DELETE FROM magic_links"))
            conn.execute(text("DELETE FROM personas")) 
            conn.execute(text("DELETE FROM users"))
            trans.commit()
        except Exception:
            trans.rollback()
            raise
    
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    yield session
    session.close()

@pytest.fixture(scope="function")
def client(test_db):
    """Create test client with database dependency override"""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    # Import and override the main get_db function
    from mvp_step1_onboarding import get_db
    app.dependency_overrides[get_db] = override_get_db
    
    # Also override the auth module's get_db function
    import email_magic_link_auth
    if hasattr(email_magic_link_auth, 'get_db'):
        app.dependency_overrides[email_magic_link_auth.get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def sample_user_data():
    """Sample user data for testing with unique email"""
    import uuid
    import time
    # Use both UUID and timestamp for extra uniqueness
    unique_id = str(uuid.uuid4())[:8]
    timestamp = str(int(time.time() * 1000))[-6:]  # Last 6 digits of milliseconds
    email = f"test-{unique_id}-{timestamp}@example.com"
    print(f"Generated unique email: {email}")  # Debug output
    return {
        "name": "Test User",
        "email": email
    }

@pytest.fixture
def sample_persona_data():
    """Sample persona data for testing"""
    return {
        "label": "Professional",
        "north_star": "Become a thought leader in tech",
        "is_calling": False
    }

@pytest.fixture
def created_user(test_db, sample_user_data):
    """Create and return a user in the database"""
    user = User(**sample_user_data)
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user

@pytest.fixture
def created_persona(test_db, created_user, sample_persona_data):
    """Create and return a persona in the database"""
    persona_data = sample_persona_data.copy()
    persona_data["user_id"] = created_user.id
    persona = Persona(**persona_data)
    test_db.add(persona)
    test_db.commit()
    test_db.refresh(persona)
    return persona

@pytest.fixture
def valid_magic_link(test_db):
    """Create a valid magic link for testing"""
    magic_link = MagicLink(
        email="test@example.com",
        token=str(uuid4()),
        expires_at=datetime.utcnow() + timedelta(minutes=10),
        used=False
    )
    test_db.add(magic_link)
    test_db.commit()
    test_db.refresh(magic_link)
    return magic_link

@pytest.fixture
def expired_magic_link(test_db):
    """Create an expired magic link for testing"""
    magic_link = MagicLink(
        email="test@example.com",
        token=str(uuid4()),
        expires_at=datetime.utcnow() - timedelta(minutes=10),
        used=False
    )
    test_db.add(magic_link)
    test_db.commit()
    test_db.refresh(magic_link)
    return magic_link

# Mock SMTP for testing email functionality
@pytest.fixture
def mock_smtp(monkeypatch):
    """Mock SMTP server for testing email sending"""
    class MockSMTP:
        def __init__(self, host, port):
            self.host = host
            self.port = port
            
        def __enter__(self):
            return self
            
        def __exit__(self, *args):
            pass
            
        def sendmail(self, from_addr, to_addrs, msg):
            # Store sent emails for verification
            if not hasattr(MockSMTP, 'sent_emails'):
                MockSMTP.sent_emails = []
            MockSMTP.sent_emails.append({
                'from': from_addr,
                'to': to_addrs,
                'message': msg
            })
            return {}
    
    import smtplib
    monkeypatch.setattr(smtplib, 'SMTP', MockSMTP)
    MockSMTP.sent_emails = []  # Reset for each test
    return MockSMTP
