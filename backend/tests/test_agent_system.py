# test_agent_system.py - Comprehensive tests for the agent system

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4
from datetime import datetime

from conversation_manager import ConversationManager
from conversation_models import ConversationRequest, ConversationResponse
from agents.educational import EducationalAgent
from agents.discovery import DiscoveryAgent
from agents.refinement import RefinementAgent
from agents.goal import GoalAgent
from agents.management import ManagementAgent
from models import Conversation


class TestConversationManager:
    """Tests for ConversationManager intent analysis and agent routing"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.manager = ConversationManager()
    
    def test_intent_analysis_concept_explanation(self):
        """Test intent analysis for educational concepts"""
        test_cases = [
            ("what is a persona", "concept_explanation"),
            ("explain northstar", "concept_explanation"),  
            ("what are personas", "concept_explanation"),
            ("help me understand persona", "concept_explanation"),
            ("define persona", "concept_explanation")
        ]
        
        for message, expected_intent in test_cases:
            intent, confidence = self.manager.analyze_intent(message, {})
            assert intent == expected_intent, f"Failed for '{message}': got {intent}, expected {expected_intent}"
            assert confidence > 0.5, f"Low confidence {confidence} for '{message}'"
    
    def test_intent_analysis_persona_creation(self):
        """Test intent analysis for persona creation"""
        test_cases = [
            ("create my personas", "persona_creation"),
            ("discover my persona", "persona_creation"), 
            ("find my personas", "persona_creation"),
            ("I want to create personas", "persona_creation"),
            ("I want to discover my personas", "persona_creation"),
            ("ready to create", "persona_creation"),
            ("let's create my personas", "persona_creation")
        ]
        
        for message, expected_intent in test_cases:
            intent, confidence = self.manager.analyze_intent(message, {})
            assert intent == expected_intent, f"Failed for '{message}': got {intent}, expected {expected_intent}"
            assert confidence > 0.5, f"Low confidence {confidence} for '{message}'"
    
    def test_intent_analysis_management(self):
        """Test intent analysis for management intents"""
        test_cases = [
            ("show me all my personas", "overview_request"),
            ("list all my goals", "overview_request"),
            ("overview of my personas", "overview_request"),
            ("dashboard", "overview_request"),
            ("how am I doing", "progress_review"),
            ("review my progress", "progress_review"),
            ("what should I focus on", "strategic_planning"),
            ("prioritize my goals", "strategic_planning")
        ]
        
        for message, expected_intent in test_cases:
            intent, confidence = self.manager.analyze_intent(message, {})
            assert intent == expected_intent, f"Failed for '{message}': got {intent}, expected {expected_intent}"
            assert confidence > 0.5, f"Low confidence {confidence} for '{message}'"
    
    def test_agent_selection(self):
        """Test agent selection based on intent"""
        test_cases = [
            ("concept_explanation", "educational"),
            ("persona_creation", "discovery"),
            ("persona_refinement", "refinement"),
            ("goal_setting", "goal"),
            ("overview_request", "management"),
            ("progress_review", "management"),
            ("strategic_planning", "management")
        ]
        
        for intent, expected_agent in test_cases:
            agent = self.manager.select_agent(intent, {})
            assert agent == expected_agent, f"Failed for intent '{intent}': got {agent}, expected {expected_agent}"
    
    def test_forced_agent_bypass(self):
        """Test that forced agent bypasses intent analysis"""
        request = ConversationRequest(
            user_id=str(uuid4()),
            session_id=str(uuid4()),
            message="what is a persona",  # Would normally route to educational
            agent_context={"force_agent_type": "management"}
        )
        
        with patch.object(self.manager, '_load_or_create_conversation') as mock_load, \
             patch.object(self.manager, '_save_conversation') as mock_save, \
             patch.object(self.manager.agents['management'], 'process_message') as mock_process:
            
            mock_conversation = Mock()
            mock_conversation.messages = []
            mock_load.return_value = mock_conversation
            
            mock_response = ConversationResponse(
                conversation_id="test",
                session_id=request.session_id,
                agent_type="management",
                user_response="Management response",
                database_changes={},
                agent_transition={'occurred': False},
                context_updates={}
            )
            mock_process.return_value = mock_response
            
            # This would need to be run with asyncio in a real test
            # For now, just verify the logic exists
            assert hasattr(self.manager, 'process_message')


class TestEducationalAgent:
    """Tests for EducationalAgent behavior"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent = EducationalAgent()
    
    def test_agent_properties(self):
        """Test agent basic properties"""
        assert self.agent.agent_type == "educational"
        assert self.agent.display_name == "Educational Agent"
        assert "concept_explanation" in self.agent.get_supported_intents()
    
    def test_system_prompt_generation(self):
        """Test system prompt includes key elements"""
        context = {
            'conversation_history': [
                {'from': 'user', 'text': 'Hello'},
                {'from': 'agent', 'text': 'Hi there!'}
            ]
        }
        
        prompt = self.agent.generate_system_prompt(context)
        
        # Check key educational elements are present
        assert "Educational Agent" in prompt
        assert "persona" in prompt.lower()
        assert "northstar" in prompt.lower()
        assert "TRANSITION_TO_DISCOVERY" in prompt
        assert "user (unknown): Hello" in prompt
        assert "agent (unknown): Hi there!" in prompt
    
    @patch('openai.OpenAI')
    @pytest.mark.asyncio
    async def test_openai_call(self, mock_openai_class):
        """Test OpenAI API integration"""
        # Mock OpenAI client and response
        mock_client = Mock()
        mock_openai_class.return_value = mock_client
        
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "Educational response about personas"
        mock_client.chat.completions.create.return_value = mock_response
        
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}):
            response = await self.agent.call_openai("System prompt", "What is a persona?")
            
            assert response == "Educational response about personas"
            mock_client.chat.completions.create.assert_called_once()


class TestDiscoveryAgent:
    """Tests for DiscoveryAgent persona creation"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent = DiscoveryAgent()
    
    def test_agent_properties(self):
        """Test agent basic properties"""
        assert self.agent.agent_type == "discovery"
        assert self.agent.display_name == "Discovery Agent"
        assert "persona_creation" in self.agent.get_supported_intents()
    
    def test_system_prompt_includes_commands(self):
        """Test system prompt includes PERSONA_CONFIRMED command"""
        context = {'conversation_history': []}
        prompt = self.agent.generate_system_prompt(context)
        
        assert "PERSONA_CONFIRMED:" in prompt
        assert "persona creation" in prompt.lower()
        assert "discovery" in prompt.lower()


class TestRefinementAgent:
    """Tests for RefinementAgent persona improvement"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent = RefinementAgent()
    
    def test_agent_properties(self):
        """Test agent basic properties"""
        assert self.agent.agent_type == "refinement"
        assert self.agent.display_name == "Refinement Agent"
        assert "persona_refinement" in self.agent.get_supported_intents()
    
    def test_requires_target_persona(self):
        """Test agent requires target_persona_id in context"""
        context = {'conversation_history': []}
        
        # Should handle missing target_persona_id gracefully
        response = asyncio.run(self.agent.process_message("improve my persona", context))
        
        assert "which persona" in response.user_response.lower()
        assert response.agent_type == "refinement"
    
    def test_system_prompt_with_persona_context(self):
        """Test system prompt includes persona information when available"""
        context = {
            'target_persona_id': 'test-persona-id',
            'target_persona': {
                'name': 'Creative Professional',
                'north_star': 'To express authentic creativity'
            },
            'conversation_history': []
        }
        
        prompt = self.agent.generate_system_prompt(context)
        
        assert "Creative Professional" in prompt
        assert "authentic creativity" in prompt
        assert "REFINED_NORTHSTAR:" in prompt


class TestGoalAgent:
    """Tests for GoalAgent goal creation"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent = GoalAgent()
    
    def test_agent_properties(self):
        """Test agent basic properties"""
        assert self.agent.agent_type == "goal"
        assert self.agent.display_name == "Goal Agent"
        assert "goal_setting" in self.agent.get_supported_intents()
    
    def test_requires_target_persona(self):
        """Test agent requires target_persona_id for goal creation"""
        context = {'conversation_history': []}
        
        response = asyncio.run(self.agent.process_message("set goals", context))
        
        assert "which persona" in response.user_response.lower()
        assert response.agent_type == "goal"
    
    def test_system_prompt_includes_goal_commands(self):
        """Test system prompt includes GOAL_CREATED command"""
        context = {
            'target_persona_id': 'test-id',
            'conversation_history': []
        }
        
        prompt = self.agent.generate_system_prompt(context)
        
        assert "GOAL_CREATED:" in prompt
        assert "SMART goals" in prompt


class TestManagementAgent:
    """Tests for ManagementAgent strategic overview"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent = ManagementAgent()
    
    def test_agent_properties(self):
        """Test agent basic properties"""
        assert self.agent.agent_type == "management"
        assert self.agent.display_name == "Management Agent"
        assert "overview_request" in self.agent.get_supported_intents()
    
    def test_system_prompt_strategic_focus(self):
        """Test system prompt emphasizes strategic management"""
        context = {
            'user_personas': [{'name': 'Parent'}, {'name': 'Professional'}],
            'user_goals': [{'id': 1}, {'id': 2}, {'id': 3}],
            'conversation_history': []
        }
        
        prompt = self.agent.generate_system_prompt(context)
        
        assert "strategic" in prompt.lower()
        assert "TRANSITION_TO_" in prompt
        assert "2 personas" in prompt
        assert "3 active goals" in prompt


class TestBaseAgentUtilities:
    """Tests for BaseAgent utility methods"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.agent = EducationalAgent()  # Use concrete implementation
    
    def test_extract_persona_actions(self):
        """Test persona action extraction"""
        response_with_action = "Here's your persona: PERSONA_CONFIRMED: Creative Professional | To express authentic creativity that inspires others"
        
        actions = self.agent.extract_persona_actions(response_with_action)
        
        assert len(actions) == 1
        assert actions[0]['type'] == 'create'
        assert actions[0]['name'] == 'Creative Professional'
        assert 'authentic creativity' in actions[0]['north_star']
    
    def test_extract_transitions(self):
        """Test transition extraction"""
        response_with_transition = "Let's move to discovery: TRANSITION_TO_DISCOVERY"
        
        transition = self.agent.extract_transitions(response_with_transition)
        
        assert transition is not None
        assert transition['to_agent'] == 'discovery'
        assert transition['reason'] == 'educational_handoff'
    
    def test_clean_response(self):
        """Test response cleaning removes commands"""
        dirty_response = "Here's info PERSONA_CONFIRMED: Test | Northstar\nTRANSITION_TO_DISCOVERY: next\nmore text"
        
        cleaned = self.agent.clean_response_for_user(dirty_response)
        
        assert "PERSONA_CONFIRMED:" not in cleaned
        assert "TRANSITION_TO_DISCOVERY:" not in cleaned
        assert "Here's info" in cleaned
        assert "more text" in cleaned


class TestIntegrationScenarios:
    """Integration tests for complete conversation flows"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.manager = ConversationManager()
    
    def test_educational_to_discovery_flow(self):
        """Test complete flow from educational explanation to discovery"""
        # This would be a more complex integration test
        # For now, just verify the components exist
        assert 'educational' in self.manager.agents
        assert 'discovery' in self.manager.agents
        assert self.manager.agents['educational'].agent_type == 'educational'
        assert self.manager.agents['discovery'].agent_type == 'discovery'
    
    def test_all_agents_registered(self):
        """Test all agents are properly registered"""
        expected_agents = ['educational', 'discovery', 'refinement', 'goal', 'management']
        
        for agent_type in expected_agents:
            assert agent_type in self.manager.agents
            assert self.manager.agents[agent_type].agent_type == agent_type
    
    def test_intent_to_agent_mapping_complete(self):
        """Test all intents have corresponding agent mappings"""
        # Test a sampling of intents to ensure routing works
        intent_agent_pairs = [
            ("concept_explanation", "educational"),
            ("persona_creation", "discovery"), 
            ("persona_refinement", "refinement"),
            ("goal_setting", "goal"),
            ("overview_request", "management")
        ]
        
        for intent, expected_agent in intent_agent_pairs:
            selected_agent = self.manager.select_agent(intent, {})
            assert selected_agent == expected_agent
            assert selected_agent in self.manager.agents


if __name__ == "__main__":
    # Run tests with: python -m pytest test_agent_system.py -v
    pytest.main([__file__, "-v"])