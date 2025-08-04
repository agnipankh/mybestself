# test_conversation_models.py - Tests for conversation Pydantic models

import pytest
from uuid import uuid4
from datetime import datetime
from pydantic import ValidationError

from conversation_models import (
    ConversationRequest,
    ConversationResponse, 
    AgentTransition,
    DatabaseChanges,
    ContextUpdates,
    PersonaAction,
    GoalAction
)


class TestConversationRequest:
    """Tests for ConversationRequest model"""
    
    def test_minimal_request(self):
        """Test creating request with minimal required fields"""
        request = ConversationRequest(
            user_id=str(uuid4()),
            session_id=str(uuid4()),
            message="Hello"
        )
        
        assert request.user_id is not None
        assert request.session_id is not None
        assert request.message == "Hello"
        assert request.conversation_id is None
        assert request.target_persona_id is None
        assert request.target_goal_id is None
        assert request.agent_context == {}
    
    def test_full_request(self):
        """Test creating request with all fields"""
        agent_context = {
            "force_agent_type": "discovery",
            "temporary_state": {"key": "value"}
        }
        
        request = ConversationRequest(
            user_id=str(uuid4()),
            session_id=str(uuid4()),
            message="Create my personas",
            conversation_id=str(uuid4()),
            target_persona_id=str(uuid4()),
            target_goal_id=str(uuid4()),
            agent_context=agent_context
        )
        
        assert request.agent_context["force_agent_type"] == "discovery"
        assert request.agent_context["temporary_state"] == {"key": "value"}
        assert request.target_persona_id is not None
        assert request.target_goal_id is not None
    
    def test_request_validation_errors(self):
        """Test validation errors for invalid requests"""
        with pytest.raises(ValidationError):
            # Missing required user_id
            ConversationRequest(
                session_id=str(uuid4()),
                message="Hello"
            )
        
        with pytest.raises(ValidationError):
            # Missing required message
            ConversationRequest(
                user_id=str(uuid4()),
                session_id=str(uuid4())
            )


class TestConversationResponse:
    """Tests for ConversationResponse model"""
    
    def test_minimal_response(self):
        """Test creating response with minimal required fields"""
        response = ConversationResponse(
            conversation_id=str(uuid4()),
            session_id=str(uuid4()),
            agent_type="educational",
            user_response="Here's your response",
            database_changes={},
            agent_transition={'occurred': False},
            context_updates={}
        )
        
        assert response.agent_type == "educational"
        assert response.user_response == "Here's your response"
        assert response.agent_transition.occurred == False
        assert response.intent is None
        assert response.intent_confidence == 0.0
    
    def test_full_response(self):
        """Test creating response with all fields"""
        agent_transition = AgentTransition(
            occurred=True,
            from_agent="educational",
            to_agent="discovery",
            reason="User ready to create personas",
            transition_message="Moving to persona creation"
        )
        
        database_changes = DatabaseChanges(
            personas_created=[PersonaAction(
                type="create",
                name="Creative Professional",
                north_star="To express authentic creativity"
            )],
            goals_created=[],
            personas_updated=[],
            goals_updated=[]
        )
        
        context_updates = ContextUpdates(
            current_agent_type="educational",
            intent="concept_explanation",
            intent_confidence=0.92
        )
        
        response = ConversationResponse(
            conversation_id=str(uuid4()),
            session_id=str(uuid4()),
            agent_type="educational",
            user_response="Educational response",
            database_changes=database_changes,
            agent_transition=agent_transition,
            context_updates=context_updates,
            intent="concept_explanation",
            intent_confidence=0.95
        )
        
        assert response.agent_transition.occurred == True
        assert response.agent_transition.to_agent == "discovery"
        assert response.database_changes.personas_created[0].name == "Creative Professional"
        assert response.context_updates.current_agent_type == "educational"
        assert response.intent == "concept_explanation"
        assert response.intent_confidence == 0.95



class TestAgentTransition:
    """Tests for AgentTransition model"""
    
    def test_no_transition(self):
        """Test no transition case"""
        transition = AgentTransition(occurred=False)
        
        assert transition.occurred == False
        assert transition.from_agent is None
        assert transition.to_agent is None
        assert transition.reason is None
        assert transition.transition_message is None
    
    def test_full_transition(self):
        """Test complete transition"""
        transition = AgentTransition(
            occurred=True,
            from_agent="educational",
            to_agent="discovery",
            reason="User confirmed readiness",
            transition_message="Let's discover your personas!"
        )
        
        assert transition.occurred == True
        assert transition.from_agent == "educational"
        assert transition.to_agent == "discovery"
        assert transition.reason == "User confirmed readiness"
        assert "personas" in transition.transition_message


class TestDatabaseChanges:
    """Tests for DatabaseChanges model"""
    
    def test_empty_changes(self):
        """Test empty database changes"""
        changes = DatabaseChanges()
        
        assert changes.personas_created == []
        assert changes.goals_created == []
        assert changes.personas_updated == []
        assert changes.goals_updated == []
    
    def test_persona_creation(self):
        """Test persona creation changes"""
        changes = DatabaseChanges(
            personas_created=[PersonaAction(
                type="create",
                name="Creative Professional",
                north_star="To express authentic creativity"
            )]
        )
        
        assert len(changes.personas_created) == 1
        assert changes.personas_created[0].name == "Creative Professional"
    
    def test_goal_creation(self):
        """Test goal creation changes"""
        changes = DatabaseChanges(
            goals_created=[GoalAction(
                type="create",
                name="Write daily",
                acceptance_criteria="Write 1000 words each morning",
                review_date="2024-01-15",
                persona_id=str(uuid4())
            )]
        )
        
        assert len(changes.goals_created) == 1
        assert changes.goals_created[0].name == "Write daily"


class TestContextUpdates:
    """Tests for ContextUpdates model"""
    
    def test_empty_updates(self):
        """Test empty context updates"""
        updates = ContextUpdates()
        
        assert updates.current_agent_type is None
        assert updates.target_persona_id is None
        assert updates.target_goal_id is None
        assert updates.intent is None
    
    def test_transition_updates(self):
        """Test transition-related updates"""
        updates = ContextUpdates(
            current_agent_type="discovery",
            target_persona_id=str(uuid4()),
            intent="persona_creation",
            intent_confidence=0.95
        )
        
        assert updates.current_agent_type == "discovery"
        assert updates.target_persona_id is not None
        assert updates.intent == "persona_creation"
        assert updates.intent_confidence == 0.95


class TestModelInteroperability:
    """Tests for how models work together"""
    
    def test_request_response_cycle(self):
        """Test full request-response cycle"""
        # Create request
        request = ConversationRequest(
            user_id=str(uuid4()),
            session_id=str(uuid4()),
            message="What is a persona?",
            agent_context={"force_agent_type": "educational"}
        )
        
        # Create response
        response = ConversationResponse(
            conversation_id=str(uuid4()),
            session_id=request.session_id,
            agent_type="educational",
            user_response="A persona represents different aspects of yourself...",
            database_changes=DatabaseChanges(),
            agent_transition=AgentTransition(occurred=False),
            context_updates=ContextUpdates(
                current_agent_type="educational"
            ),
            intent="concept_explanation",
            intent_confidence=0.92
        )
        
        # Verify they work together
        assert request.session_id == response.session_id
        assert request.agent_context["force_agent_type"] == response.agent_type
        assert response.intent == "concept_explanation"
    
    def test_complex_agent_flow(self):
        """Test complex multi-agent flow data structures"""
        # Educational to Discovery transition
        educational_response = ConversationResponse(
            conversation_id=str(uuid4()),
            session_id=str(uuid4()),
            agent_type="educational",
            user_response="Now that you understand personas, shall we discover yours?",
            database_changes=DatabaseChanges(),
            agent_transition=AgentTransition(
                occurred=True,
                from_agent="educational",
                to_agent="discovery",
                reason="User understands concepts",
                transition_message="Moving to persona discovery"
            ),
            context_updates=ContextUpdates(
                current_agent_type="educational",
                intent="concept_explanation"
            )
        )
        
        # Discovery persona creation
        discovery_response = ConversationResponse(
            conversation_id=educational_response.conversation_id,
            session_id=educational_response.session_id,
            agent_type="discovery",
            user_response="Great! I've identified your Creative Professional persona.",
            database_changes=DatabaseChanges(
                personas_created=[PersonaAction(
                    type="create",
                    name="Creative Professional",
                    north_star="To express authentic creativity that inspires others"
                )]
            ),
            agent_transition=AgentTransition(occurred=False),
            context_updates=ContextUpdates(
                current_agent_type="discovery"
            )
        )
        
        # Verify flow continuity
        assert educational_response.agent_transition.to_agent == discovery_response.agent_type
        assert educational_response.conversation_id == discovery_response.conversation_id
        assert len(discovery_response.database_changes.personas_created) == 1


if __name__ == "__main__":
    # Run tests with: python -m pytest test_conversation_models.py -v
    pytest.main([__file__, "-v"])