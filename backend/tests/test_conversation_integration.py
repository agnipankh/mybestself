# test_conversation_integration.py - Integration tests for conversation endpoint

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from uuid import uuid4
import json

# Import the FastAPI app and dependencies
from mvp_step1_onboarding import app, get_db
from conversation_models import ConversationRequest
from models import User, Conversation, MagicLink


class TestConversationEndpointIntegration:
    """Integration tests for the /api/conversation/process endpoint"""
    
    def test_conversation_endpoint_exists(self, client):
        """Test that the conversation endpoint exists"""
        # Test with invalid data to confirm endpoint exists
        response = client.post("/api/conversation/process", json={})
        
        # Should return 422 (validation error) not 404 (not found)
        assert response.status_code == 422
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})
    @patch('openai.OpenAI')
    def test_educational_agent_conversation(self, mock_openai_class, client, test_db):
        """Test complete conversation flow with educational agent"""
        # Set up OpenAI mock
        mock_client = Mock()
        mock_openai_class.return_value = mock_client
        
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = """A persona represents a different aspect or role in your life - like being a parent, professional, or creative individual. Each persona has its own northstar (guiding aspiration) that helps you focus your growth in that area.

Would you like to discover your own personas? I can help you identify the key roles and aspirations in your life."""
        mock_client.chat.completions.create.return_value = mock_response
        
        # Create test user first
        test_user = User(
            id=str(uuid4()),
            email="test@example.com"
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        # Create conversation request
        request_data = {
            "user_id": str(test_user.id),
            "session_id": str(uuid4()),
            "message": "What is a persona?"
        }
        
        # Make request to conversation endpoint
        response = client.post("/api/conversation/process", json=request_data)
        
        # Verify response
        assert response.status_code == 200
        response_data = response.json()
        
        assert response_data["agent_type"] == "educational"
        assert "persona represents" in response_data["user_response"]
        assert response_data["intent"] == "concept_explanation"
        assert response_data["intent_confidence"] > 0.5
    
    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'})  
    @patch('openai.OpenAI')
    def test_forced_agent_routing(self, mock_openai_class, client, test_db):
        """Test forcing specific agent bypasses intent analysis"""
        # Set up OpenAI mock
        mock_client = Mock()
        mock_openai_class.return_value = mock_client
        
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "I'd be happy to help you manage your personas and goals strategically. Let me provide an overview of your current development portfolio."
        mock_client.chat.completions.create.return_value = mock_response
        
        # Create test user
        test_user = User(
            id=str(uuid4()),
            email="test@example.com"
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        # Create request that would normally route to educational but force management
        request_data = {
            "user_id": str(test_user.id),
            "session_id": str(uuid4()),
            "message": "What is a persona?",  # Educational intent
            "agent_context": {
                "force_agent_type": "management"  # Force management
            }
        }
        
        response = client.post("/api/conversation/process", json=request_data)
        
        assert response.status_code == 200
        response_data = response.json()
        
        # Should use management agent despite educational intent
        assert response_data["agent_type"] == "management"
        assert response_data["intent"] == "forced_management"
    
    def test_intent_analysis_routing(self, client, test_db):
        """Test that different messages route to correct agents"""
        test_cases = [
            ("what is a persona", "educational"),
            ("show me all my personas", "management"),
            ("I want to create personas", "discovery"),
            ("improve my Creative Professional persona", "refinement")
        ]
        
        test_user = User(
            id=str(uuid4()),
            email="test@example.com"
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        for message, expected_agent in test_cases:
            with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
                with patch('openai.OpenAI') as mock_openai_class:
                    # Mock OpenAI response
                    mock_client = Mock()
                    mock_openai_class.return_value = mock_client
                    
                    mock_response = Mock()
                    mock_response.choices = [Mock()]
                    mock_response.choices[0].message.content = f"Response from {expected_agent} agent"
                    mock_client.chat.completions.create.return_value = mock_response
                    
                    request_data = {
                        "user_id": str(test_user.id),
                        "session_id": str(uuid4()),
                        "message": message
                    }
                    
                    response = client.post("/api/conversation/process", json=request_data)
                    
                    assert response.status_code == 200
                    response_data = response.json()
                    assert response_data["agent_type"] == expected_agent, f"Message '{message}' should route to {expected_agent} but got {response_data['agent_type']}"
    
    def test_conversation_persistence(self, client, test_db):
        """Test that conversations are saved to database"""
        test_user = User(
            id=str(uuid4()),
            email="test@example.com",
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            with patch('openai.OpenAI') as mock_openai_class:
                # Mock OpenAI response
                mock_client = Mock()
                mock_openai_class.return_value = mock_client
                
                mock_response = Mock()
                mock_response.choices = [Mock()]
                mock_response.choices[0].message.content = "Educational response"
                mock_client.chat.completions.create.return_value = mock_response
                
                session_id = str(uuid4())
                request_data = {
                    "user_id": str(test_user.id),
                    "session_id": session_id,
                    "message": "What is a persona?"
                }
                
                response = client.post("/api/conversation/process", json=request_data)
                
                assert response.status_code == 200
                response_data = response.json()
                
                # Verify conversation was saved to database
                conversation = test_db.query(Conversation).filter(
                    Conversation.id == response_data["conversation_id"]
                ).first()
                
                assert conversation is not None
                assert conversation.user_id == test_user.id
                assert conversation.agent_type == "educational"
                assert len(conversation.messages) == 2  # User message + agent response
                assert conversation.messages[0]['from'] == 'user'
                assert conversation.messages[1]['from'] == 'agent'
    
    def test_conversation_continuation(self, client, test_db):
        """Test continuing an existing conversation"""
        test_user = User(
            id=str(uuid4()),
            email="test@example.com",
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        # Create initial conversation
        conversation_id = str(uuid4())
        session_id = str(uuid4())
        
        initial_conversation = Conversation(
            id=conversation_id,
            user_id=test_user.id,
            session_id=session_id,
            conversation_type='agent_conversation',
            topic='Test Conversation',
            agent_type='educational',
            messages=[
                {
                    'id': 'msg-1',
                    'from': 'user',
                    'text': 'Hello',
                    'timestamp': '2024-01-01T10:00:00',
                    'agent_type': 'educational'
                }
            ],
            context_state={}
        )
        test_db.add(initial_conversation)
        test_db.commit()
        
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            with patch('openai.OpenAI') as mock_openai_class:
                # Mock OpenAI response
                mock_client = Mock()
                mock_openai_class.return_value = mock_client
                
                mock_response = Mock()
                mock_response.choices = [Mock()]
                mock_response.choices[0].message.content = "Follow-up educational response"
                mock_client.chat.completions.create.return_value = mock_response
                
                # Continue conversation
                request_data = {
                    "user_id": str(test_user.id),
                    "session_id": session_id,
                    "conversation_id": conversation_id,
                    "message": "Tell me more"
                }
                
                response = client.post("/api/conversation/process", json=request_data)
                
                assert response.status_code == 200
                response_data = response.json()
                
                # Verify conversation was updated
                updated_conversation = test_db.query(Conversation).filter(
                    Conversation.id == conversation_id
                ).first()
                
                assert len(updated_conversation.messages) == 3  # Original + new user + new agent
                assert updated_conversation.messages[-1]['from'] == 'agent'
                assert updated_conversation.messages[-1]['text'] == "Follow-up educational response"
    
    def test_error_handling(self, client):
        """Test error handling for invalid requests"""
        # Test missing required fields
        response = client.post("/api/conversation/process", json={})
        assert response.status_code == 422
        
        # Test invalid user_id
        request_data = {
            "user_id": "invalid-uuid",
            "session_id": str(uuid4()),
            "message": "Hello"
        }
        response = client.post("/api/conversation/process", json=request_data)
        assert response.status_code in [400, 422, 500]  # Some validation error
    
    def test_openai_api_error_handling(self, client, test_db):
        """Test handling of OpenAI API errors"""
        test_user = User(
            id=str(uuid4()),
            email="test@example.com",
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            with patch('openai.OpenAI') as mock_openai_class:
                # Mock OpenAI client that raises an exception
                mock_client = Mock()
                mock_openai_class.return_value = mock_client
                mock_client.chat.completions.create.side_effect = Exception("OpenAI API Error")
                
                request_data = {
                    "user_id": str(test_user.id),
                    "session_id": str(uuid4()),
                    "message": "What is a persona?"
                }
                
                response = client.post("/api/conversation/process", json=request_data)
                
                # Should handle the error gracefully
                assert response.status_code == 500
                assert "error" in response.json() or "detail" in response.json()


class TestAgentSpecificBehavior:
    """Test specific agent behaviors in integration context"""
    
    def test_refinement_agent_requires_persona_id(self, client, test_db):
        """Test refinement agent behavior when no persona_id provided"""
        test_user = User(
            id=str(uuid4()),
            email="test@example.com",
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            request_data = {
                "user_id": str(test_user.id),
                "session_id": str(uuid4()),
                "message": "improve my persona",
                "agent_context": {
                    "force_agent_type": "refinement"
                }
            }
            
            response = client.post("/api/conversation/process", json=request_data)
            
            assert response.status_code == 200
            response_data = response.json()
            
            assert response_data["agent_type"] == "refinement"
            assert "which persona" in response_data["user_response"].lower()
    
    def test_goal_agent_requires_persona_id(self, client, test_db):
        """Test goal agent behavior when no persona_id provided"""
        test_user = User(
            id=str(uuid4()),
            email="test@example.com",
        )
        test_db.add(test_user)
        test_db.commit()
        test_db.refresh(test_user)
        
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            request_data = {
                "user_id": str(test_user.id),
                "session_id": str(uuid4()),
                "message": "set goals",
                "agent_context": {
                    "force_agent_type": "goal"
                }
            }
            
            response = client.post("/api/conversation/process", json=request_data)
            
            assert response.status_code == 200
            response_data = response.json()
            
            assert response_data["agent_type"] == "goal"
            assert "which persona" in response_data["user_response"].lower()


if __name__ == "__main__":
    # Run tests with: python -m pytest test_conversation_integration.py -v
    pytest.main([__file__, "-v"])