# test_api_endpoints.py - Functional tests for FastAPI endpoints

import pytest
from fastapi import status
from models import User, Persona

class TestUserEndpoints:
    """Test user-related API endpoints"""
    
    def test_create_user_success(self, client, sample_user_data):
        """Test successful user creation"""
        response = client.post("/users/", json=sample_user_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["name"] == sample_user_data["name"]
        assert data["email"] == sample_user_data["email"]
        assert "id" in data
        assert "created_at" in data
    
    def test_create_user_missing_email(self, client):
        """Test user creation with missing email"""
        user_data = {"name": "Test User"}
        response = client.post("/users/", json=user_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_create_user_missing_name(self, client):
        """Test user creation with missing name (should fail due to API validation)"""
        user_data = {"email": "test@example.com"}
        response = client.post("/users/", json=user_data)
        
        # Current API requires name field in UserCreate schema
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_create_duplicate_email_user(self, client, sample_user_data):
        """Test creating users with duplicate emails"""
        # Create first user - should succeed
        response1 = client.post("/users/", json=sample_user_data)
        assert response1.status_code == status.HTTP_200_OK
        
        # Try to create second user with same email - should return 409 Conflict
        response2 = client.post("/users/", json=sample_user_data)
        assert response2.status_code == status.HTTP_409_CONFLICT
        
        # Check error message
        data = response2.json()
        assert "email" in data["detail"].lower() or "already exists" in data["detail"].lower()

class TestPersonaEndpoints:
    """Test persona-related API endpoints"""
    
    def test_create_persona_success(self, client, created_user, sample_persona_data):
        """Test successful persona creation"""
        persona_data = sample_persona_data.copy()
        persona_data["user_id"] = str(created_user.id)
        
        response = client.post("/personas/", json=persona_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["label"] == sample_persona_data["label"]
        assert data["north_star"] == sample_persona_data["north_star"]
        assert data["is_calling"] == sample_persona_data["is_calling"]
        assert data["user_id"] == str(created_user.id)
        assert "id" in data
        assert "created_at" in data
    
    def test_create_persona_nonexistent_user(self, client, sample_persona_data):
        """Test creating persona for non-existent user"""
        persona_data = sample_persona_data.copy()
        persona_data["user_id"] = "00000000-0000-0000-0000-000000000000"
        
        response = client.post("/personas/", json=persona_data)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "User not found" in data["detail"]
    
    def test_create_persona_missing_fields(self, client, created_user):
        """Test creating persona with missing required fields"""
        # Missing label
        persona_data = {
            "user_id": str(created_user.id),
            "north_star": "Some goal"
        }
        response = client.post("/personas/", json=persona_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Missing north_star
        persona_data = {
            "user_id": str(created_user.id),
            "label": "Some label"
        }
        response = client.post("/personas/", json=persona_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_list_user_personas(self, client, created_user):
        """Test listing personas for a user"""
        # Create some personas
        persona_data_1 = {
            "user_id": str(created_user.id),
            "label": "Professional",
            "north_star": "Career success",
            "is_calling": False
        }
        persona_data_2 = {
            "user_id": str(created_user.id),
            "label": "Parent",
            "north_star": "Raise happy kids",
            "is_calling": True
        }
        
        client.post("/personas/", json=persona_data_1)
        client.post("/personas/", json=persona_data_2)
        
        # List personas
        response = client.get(f"/users/{created_user.id}/personas")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 2
        labels = [persona["label"] for persona in data]
        assert "Professional" in labels
        assert "Parent" in labels
    
    def test_list_personas_nonexistent_user(self, client):
        """Test listing personas for non-existent user"""
        fake_user_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/users/{fake_user_id}/personas")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "User not found" in data["detail"]
    
    def test_update_persona_success(self, client, created_persona):
        """Test successful persona update"""
        update_data = {
            "label": "Updated Professional",
            "north_star": "Updated career goals",
            "is_calling": True
        }
        
        response = client.put(f"/personas/{created_persona.id}", json=update_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["label"] == "Updated Professional"
        assert data["north_star"] == "Updated career goals"
        assert data["is_calling"] is True
    
    def test_update_persona_partial(self, client, created_persona):
        """Test partial persona update"""
        original_label = created_persona.label
        original_north_star = created_persona.north_star
        
        update_data = {"is_calling": True}
        
        response = client.put(f"/personas/{created_persona.id}", json=update_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Only is_calling should be updated
        assert data["label"] == original_label
        assert data["north_star"] == original_north_star
        assert data["is_calling"] is True
    
    def test_update_nonexistent_persona(self, client):
        """Test updating non-existent persona"""
        fake_persona_id = "00000000-0000-0000-0000-000000000000"
        update_data = {"label": "Should not work"}
        
        response = client.put(f"/personas/{fake_persona_id}", json=update_data)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "Persona not found" in data["detail"]
    
    def test_delete_persona_success(self, client, created_persona):
        """Test successful persona deletion"""
        user_id = str(created_persona.user_id)
        label = created_persona.label
        
        response = client.delete(f"/personas/?user_id={user_id}&label={label}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert f"Persona '{label}' deleted" in data["message"]
    
    def test_delete_nonexistent_persona(self, client, created_user):
        """Test deleting non-existent persona"""
        user_id = str(created_user.id)
        label = "NonexistentPersona"
        
        response = client.delete(f"/personas/?user_id={user_id}&label={label}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "Persona not found" in data["detail"]

class TestAPIErrorHandling:
    """Test API error handling and edge cases"""
    
    def test_invalid_user_id_format(self, client):
        """Test API with invalid UUID format"""
        response = client.get("/users/invalid-uuid/personas")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_invalid_persona_id_format(self, client):
        """Test API with invalid persona UUID format"""
        update_data = {"label": "Test"}
        response = client.put("/personas/invalid-uuid", json=update_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_empty_request_body(self, client):
        """Test API endpoints with empty request body"""
        # Empty user creation
        response = client.post("/users/", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Empty persona creation
        response = client.post("/personas/", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

class TestAPIIntegration:
    """Test complete workflows and integration scenarios"""
    
    def test_complete_user_persona_workflow(self, client):
        """Test complete workflow: create user, add personas, update, delete"""
        # 1. Create user
        user_data = {"name": "Workflow User", "email": "workflow@example.com"}
        user_response = client.post("/users/", json=user_data)
        assert user_response.status_code == status.HTTP_200_OK
        user = user_response.json()
        user_id = user["id"]
        
        # 2. Create first persona
        persona1_data = {
            "user_id": user_id,
            "label": "Professional",
            "north_star": "Career excellence",
            "is_calling": False
        }
        persona1_response = client.post("/personas/", json=persona1_data)
        assert persona1_response.status_code == status.HTTP_200_OK
        persona1 = persona1_response.json()
        
        # 3. Create second persona
        persona2_data = {
            "user_id": user_id,
            "label": "Artist",
            "north_star": "Creative expression",
            "is_calling": True
        }
        persona2_response = client.post("/personas/", json=persona2_data)
        assert persona2_response.status_code == status.HTTP_200_OK
        
        # 4. List personas
        list_response = client.get(f"/users/{user_id}/personas")
        assert list_response.status_code == status.HTTP_200_OK
        personas = list_response.json()
        assert len(personas) == 2
        
        # 5. Update first persona
        update_data = {"label": "Senior Professional", "is_calling": True}
        update_response = client.put(f"/personas/{persona1['id']}", json=update_data)
        assert update_response.status_code == status.HTTP_200_OK
        updated_persona = update_response.json()
        assert updated_persona["label"] == "Senior Professional"
        assert updated_persona["is_calling"] is True
        
        # 6. Delete second persona
        delete_response = client.delete(f"/personas/?user_id={user_id}&label=Artist")
        assert delete_response.status_code == status.HTTP_200_OK
        
        # 7. Verify only one persona remains
        final_list_response = client.get(f"/users/{user_id}/personas")
        assert final_list_response.status_code == status.HTTP_200_OK
        final_personas = final_list_response.json()
        assert len(final_personas) == 1
        assert final_personas[0]["label"] == "Senior Professional"
