# test_auth_endpoints.py - Tests for authentication endpoints

import pytest
from fastapi import status
from datetime import datetime, timedelta
from models import MagicLink, User

class TestMagicLinkRequest:
    """Test magic link request endpoint"""
    
    def test_request_magic_link_success(self, client, mock_smtp):
        """Test successful magic link request"""
        email_data = {"email": "test@example.com"}
        
        response = client.post("/auth/request", json=email_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Magic link sent"
        
        # Verify email was sent
        assert len(mock_smtp.sent_emails) == 1
        sent_email = mock_smtp.sent_emails[0]
        assert sent_email["from"] == "no-reply@mybestself.app"
        assert "test@example.com" in sent_email["to"]
        assert "Click the link to sign in" in sent_email["message"]
    
    def test_request_magic_link_invalid_email(self, client):
        """Test magic link request with invalid email format"""
        email_data = {"email": "invalid-email"}
        
        response = client.post("/auth/request", json=email_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_request_magic_link_missing_email(self, client):
        """Test magic link request with missing email"""
        response = client.post("/auth/request", json={})
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_request_magic_link_creates_database_entry(self, client, test_db, mock_smtp):
        """Test that magic link request creates proper database entry"""
        email_data = {"email": "test@example.com"}
        
        response = client.post("/auth/request", json=email_data)
        assert response.status_code == status.HTTP_200_OK
        
        # Refresh the session to see committed data
        test_db.expire_all()
        
        # Check database entry
        magic_link = test_db.query(MagicLink).filter_by(email="test@example.com").first()
        assert magic_link is not None
        assert magic_link.email == "test@example.com"
        assert magic_link.token is not None
        assert len(magic_link.token) > 10  # Should be a UUID string
        assert magic_link.expires_at > datetime.utcnow()
        assert magic_link.used is False
        assert magic_link.user_id is None
    
    def test_multiple_magic_link_requests(self, client, test_db, mock_smtp):
        """Test multiple magic link requests for same email"""
        email_data = {"email": "test@example.com"}
        
        # First request
        response1 = client.post("/auth/request", json=email_data)
        assert response1.status_code == status.HTTP_200_OK
        
        # Second request
        response2 = client.post("/auth/request", json=email_data)
        assert response2.status_code == status.HTTP_200_OK
        
        # Should have two separate magic links
        magic_links = test_db.query(MagicLink).filter_by(email="test@example.com").all()
        assert len(magic_links) == 2
        assert magic_links[0].token != magic_links[1].token

class TestMagicLinkVerification:
    """Test magic link verification endpoint"""
    
    def test_verify_valid_magic_link_new_user(self, client, test_db, valid_magic_link):
        """Test verifying valid magic link for new user"""
        response = client.get(f"/auth/verify?token={valid_magic_link.token}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["message"] == "Authentication successful"
        assert "user_id" in data
        assert data["email"] == valid_magic_link.email
        
        # Check that user was created
        user = test_db.query(User).filter_by(email=valid_magic_link.email).first()
        assert user is not None
        assert user.email == valid_magic_link.email
        
        # Check that magic link was marked as used
        test_db.refresh(valid_magic_link)
        assert valid_magic_link.used is True
    
    def test_verify_valid_magic_link_existing_user(self, client, test_db, created_user):
        """Test verifying valid magic link for existing user"""
        # Create magic link for existing user
        magic_link = MagicLink(
            email=created_user.email,
            token="existing-user-token",
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            used=False
        )
        test_db.add(magic_link)
        test_db.commit()
        
        response = client.get(f"/auth/verify?token={magic_link.token}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["message"] == "Authentication successful"
        assert data["user_id"] == str(created_user.id)
        assert data["email"] == created_user.email
        
        # Check that magic link was marked as used
        test_db.refresh(magic_link)
        assert magic_link.used is True
    
    def test_verify_invalid_token(self, client):
        """Test verifying with invalid token"""
        response = client.get("/auth/verify?token=invalid-token")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "Invalid or used token" in data["detail"]
    
    def test_verify_expired_magic_link(self, client, expired_magic_link):
        """Test verifying expired magic link"""
        response = client.get(f"/auth/verify?token={expired_magic_link.token}")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Token expired" in data["detail"]
    
    def test_verify_used_magic_link(self, client, test_db, valid_magic_link):
        """Test verifying already used magic link"""
        # Mark magic link as used
        valid_magic_link.used = True
        test_db.commit()
        
        response = client.get(f"/auth/verify?token={valid_magic_link.token}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "Invalid or used token" in data["detail"]
    
    def test_verify_missing_token(self, client):
        """Test verification without token parameter"""
        response = client.get("/auth/verify")
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

class TestAuthenticationFlow:
    """Test complete authentication flow"""
    
    def test_complete_auth_flow_new_user(self, client, test_db, mock_smtp):
        """Test complete flow: request -> verify for new user"""
        email = "newuser@example.com"
        
        # 1. Request magic link
        request_response = client.post("/auth/request", json={"email": email})
        assert request_response.status_code == status.HTTP_200_OK
        
        # 2. Extract token from database (simulating email click)
        magic_link = test_db.query(MagicLink).filter_by(email=email).first()
        assert magic_link is not None
        token = magic_link.token
        
        # 3. Verify magic link
        verify_response = client.get(f"/auth/verify?token={token}")
        assert verify_response.status_code == status.HTTP_200_OK
        
        verify_data = verify_response.json()
        assert verify_data["email"] == email
        
        # 4. Check user was created
        user = test_db.query(User).filter_by(email=email).first()
        assert user is not None
        assert str(user.id) == verify_data["user_id"]
        
        # 5. Check magic link was consumed
        test_db.refresh(magic_link)
        assert magic_link.used is True
    
    def test_complete_auth_flow_existing_user(self, client, test_db, created_user, mock_smtp):
        """Test complete flow: request -> verify for existing user"""
        email = created_user.email
        original_user_count = test_db.query(User).count()
        
        # 1. Request magic link
        request_response = client.post("/auth/request", json={"email": email})
        assert request_response.status_code == status.HTTP_200_OK
        
        # 2. Extract token from database
        magic_link = test_db.query(MagicLink).filter_by(email=email).first()
        assert magic_link is not None
        token = magic_link.token
        
        # 3. Verify magic link
        verify_response = client.get(f"/auth/verify?token={token}")
        assert verify_response.status_code == status.HTTP_200_OK
        
        verify_data = verify_response.json()
        assert verify_data["email"] == email
        assert verify_data["user_id"] == str(created_user.id)
        
        # 4. Check no new user was created
        final_user_count = test_db.query(User).count()
        assert final_user_count == original_user_count
    
    def test_multiple_requests_single_verification(self, client, test_db, mock_smtp):
        """Test multiple magic link requests but only one verification"""
        email = "multiplelinks@example.com"
        
        # 1. Request multiple magic links
        client.post("/auth/request", json={"email": email})
        client.post("/auth/request", json={"email": email})
        client.post("/auth/request", json={"email": email})
        
        # Should have 3 magic links
        magic_links = test_db.query(MagicLink).filter_by(email=email).all()
        assert len(magic_links) == 3
        
        # 2. Use the first one
        first_token = magic_links[0].token
        verify_response = client.get(f"/auth/verify?token={first_token}")
        assert verify_response.status_code == status.HTTP_200_OK
        
        # 3. Try to use another one (should still work as they're separate)
        second_token = magic_links[1].token
        verify_response2 = client.get(f"/auth/verify?token={second_token}")
        assert verify_response2.status_code == status.HTTP_200_OK
        
        # 4. Check only one user was created despite multiple verifications
        users = test_db.query(User).filter_by(email=email).all()
        assert len(users) == 1

class TestAuthErrorHandling:
    """Test error handling in authentication"""
    
    def test_malformed_requests(self, client):
        """Test various malformed requests"""
        # Invalid JSON for POST request
        response = client.post("/auth/request", data="invalid json")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Missing required fields
        response = client.post("/auth/request", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Wrong data type for email
        response = client.post("/auth/request", json={"email": 123})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_sql_injection_attempts(self, client):
        """Test SQL injection attempts in email and token fields"""
        # SQL injection in email
        malicious_email = "test@example.com'; DROP TABLE users; --"
        response = client.post("/auth/request", json={"email": malicious_email})
        # Should fail validation before reaching database
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # SQL injection in token
        malicious_token = "token'; DROP TABLE magic_links; --"
        response = client.get(f"/auth/verify?token={malicious_token}")
        # Should safely handle the malicious token
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_extremely_long_inputs(self, client):
        """Test handling of extremely long inputs"""
        # Very long email
        long_email = "a" * 1000 + "@example.com"
        response = client.post("/auth/request", json={"email": long_email})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Very long token
        long_token = "a" * 1000
        response = client.get(f"/auth/verify?token={long_token}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
