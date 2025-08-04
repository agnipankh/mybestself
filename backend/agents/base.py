# agents/base.py - Base agent abstract class

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from conversation_models import ConversationResponse, DatabaseChanges, AgentTransition, ContextUpdates, AgentType


class BaseAgent(ABC):
    """
    Abstract base class for all conversation agents.
    
    Each agent specializes in handling specific types of user intents:
    - EducationalAgent: Explains concepts, provides examples
    - DiscoveryAgent: Helps users discover and create personas  
    - RefinementAgent: Improves existing personas
    - GoalAgent: Creates and manages goals for personas
    - ManagementAgent: Overview and management of personas/goals
    """
    
    def __init__(self):
        """Initialize the agent"""
        pass
    
    @property
    @abstractmethod
    def agent_type(self) -> str:
        """Return the agent type identifier"""
        pass
    
    @property
    @abstractmethod
    def display_name(self) -> str:
        """Return human-readable agent name"""
        pass
    
    @abstractmethod
    def generate_system_prompt(self, context: Dict[str, Any]) -> str:
        """
        Generate the system prompt for this agent given the conversation context.
        
        Args:
            context: Dictionary containing conversation context including:
                - conversation_history: List of previous messages
                - target_persona_id: Optional persona being worked on
                - target_goal_id: Optional goal being worked on
                - temporary_state: Agent-specific temporary data
                - session_id: Current session identifier
        
        Returns:
            System prompt string for AI model
        """
        pass
    
    @abstractmethod
    def process_ai_response(self, ai_response: str, context: Dict[str, Any]) -> ConversationResponse:
        """
        Process the AI response and extract any actions to perform.
        
        Args:
            ai_response: Raw response from AI model
            context: Current conversation context
            
        Returns:
            ConversationResponse with actions and context updates
        """
        pass
    
    def can_handle_intent(self, intent: str, context: Dict[str, Any]) -> bool:
        """
        Check if this agent can handle the given intent.
        
        Args:
            intent: Detected user intent
            context: Current conversation context
            
        Returns:
            True if this agent should handle this intent
        """
        # Default implementation - subclasses can override
        return intent in self.get_supported_intents()
    
    @abstractmethod
    def get_supported_intents(self) -> list[str]:
        """
        Return list of intents this agent can handle.
        
        Returns:
            List of intent strings
        """
        pass
    
    def clean_response_for_user(self, ai_response: str) -> str:
        """
        Clean AI response by removing agent-specific formatting/commands.
        
        Args:
            ai_response: Raw AI response
            
        Returns:
            Cleaned response suitable for user display
        """
        # Remove common agent command patterns that shouldn't be shown to user
        cleaned = ai_response
        
        # Remove persona confirmation commands
        import re
        cleaned = re.sub(r'PERSONA_CONFIRMED:\s*[^|]+\|[^\n]+\n?', '', cleaned, flags=re.IGNORECASE)
        
        # Remove refined northstar commands  
        cleaned = re.sub(r'REFINED_NORTHSTAR:\s*[^\n]+\n?', '', cleaned, flags=re.IGNORECASE)
        
        # Remove variant persona commands
        cleaned = re.sub(r'VARIANT_PERSONA:\s*[^|]+\|[^\n]+\n?', '', cleaned, flags=re.IGNORECASE)
        
        # Remove goal creation commands
        cleaned = re.sub(r'GOAL_CREATED:\s*[^|]+\|[^\n]+\n?', '', cleaned, flags=re.IGNORECASE)
        
        # Remove transition commands
        cleaned = re.sub(r'TRANSITION_TO_[A-Z]+:\s*[^\n]+\n?', '', cleaned, flags=re.IGNORECASE)
        
        return cleaned.strip()
    
    def extract_persona_actions(self, ai_response: str) -> list[Dict[str, Any]]:
        """
        Extract persona creation/update commands from AI response.
        
        Args:
            ai_response: Raw AI response
            
        Returns:
            List of persona actions to perform
        """
        import re
        actions = []
        
        # Look for PERSONA_CONFIRMED: Name | Northstar
        persona_matches = re.findall(r'PERSONA_CONFIRMED:\s*([^|]+)\|\s*([^\n]+)', ai_response, re.IGNORECASE)
        for name, northstar in persona_matches:
            actions.append({
                'type': 'create',
                'name': name.strip(),
                'north_star': northstar.strip()
            })
        
        # Look for REFINED_NORTHSTAR: Updated northstar
        refined_matches = re.findall(r'REFINED_NORTHSTAR:\s*([^\n]+)', ai_response, re.IGNORECASE)
        for northstar in refined_matches:
            actions.append({
                'type': 'update_northstar',
                'north_star': northstar.strip()
            })
            
        return actions
    
    def extract_goal_actions(self, ai_response: str) -> list[Dict[str, Any]]:
        """
        Extract goal creation/update commands from AI response.
        
        Args:
            ai_response: Raw AI response
            
        Returns:
            List of goal actions to perform
        """
        import re 
        actions = []
        
        # Look for GOAL_CREATED: Name | Acceptance Criteria | Review Date
        goal_matches = re.findall(r'GOAL_CREATED:\s*([^|]+)\|\s*([^|]+)\|\s*([^\n]+)', ai_response, re.IGNORECASE)
        for name, criteria, review_date in goal_matches:
            actions.append({
                'type': 'create',
                'name': name.strip(),
                'acceptance_criteria': criteria.strip(),
                'review_date': review_date.strip()
            })
            
        return actions
    
    def extract_transitions(self, ai_response: str) -> Optional[Dict[str, str]]:
        """
        Extract agent transition commands from AI response.
        
        Args:
            ai_response: Raw AI response
            
        Returns:
            Transition information if found, None otherwise
        """
        import re
        
        # Look for TRANSITION_TO_GOALS: persona_name
        goals_match = re.search(r'TRANSITION_TO_GOALS:\s*([^\n]+)', ai_response, re.IGNORECASE)
        if goals_match:
            return {
                'to_agent': 'goal',
                'reason': 'action_triggered',
                'persona_name': goals_match.group(1).strip()
            }
            
        # Look for TRANSITION_TO_DISCOVERY
        if re.search(r'TRANSITION_TO_DISCOVERY', ai_response, re.IGNORECASE):
            return {
                'to_agent': 'discovery',
                'reason': 'educational_handoff'
            }
            
        # Look for TRANSITION_TO_REFINEMENT: persona_id
        refinement_match = re.search(r'TRANSITION_TO_REFINEMENT:\s*([^\n]+)', ai_response, re.IGNORECASE)
        if refinement_match:
            return {
                'to_agent': 'refinement',
                'reason': 'action_triggered',
                'persona_id': refinement_match.group(1).strip()
            }
            
        return None
    
    def build_conversation_response(
        self,
        conversation_id: str,
        session_id: Optional[str],
        ai_response: str,
        context: Dict[str, Any],
        previous_agent_type: Optional[str] = None
    ) -> ConversationResponse:
        """
        Build a complete ConversationResponse from AI response and context.
        
        Args:
            conversation_id: Current conversation ID
            session_id: Current session ID  
            ai_response: Raw AI response
            context: Current conversation context
            previous_agent_type: Previous agent if transition occurred
            
        Returns:
            Complete ConversationResponse
        """
        # Extract actions from AI response
        persona_actions = self.extract_persona_actions(ai_response)
        goal_actions = self.extract_goal_actions(ai_response)
        transition_info = self.extract_transitions(ai_response)
        
        # Clean response for user
        user_response = self.clean_response_for_user(ai_response)
        
        # Build database changes
        database_changes = DatabaseChanges()
        if persona_actions:
            database_changes.personas_created = [
                action for action in persona_actions if action['type'] == 'create'
            ]
        if goal_actions:
            database_changes.goals_created = [
                action for action in goal_actions if action['type'] == 'create'
            ]
        
        # Build agent transition
        agent_transition = AgentTransition(occurred=False)
        if transition_info:
            agent_transition = AgentTransition(
                occurred=True,
                from_agent=self.agent_type,
                to_agent=transition_info['to_agent'],
                reason=transition_info['reason'],
                suggested_route=self._get_route_for_agent(transition_info['to_agent']),
                transition_message=self._get_transition_message(transition_info)
            )
        
        # Build context updates
        context_updates = ContextUpdates(
            current_agent_type=self.agent_type,
            temporary_state=context.get('temporary_state', {})
        )
        
        return ConversationResponse(
            conversation_id=conversation_id,
            session_id=session_id,
            agent_type=self.agent_type,
            previous_agent_type=previous_agent_type,
            user_response=user_response,
            database_changes=database_changes,
            agent_transition=agent_transition,
            context_updates=context_updates
        )
    
    def _get_route_for_agent(self, agent_type: str) -> str:
        """Get frontend route for agent type"""
        route_map = {
            'discovery': '/personas/discovery',
            'refinement': '/personas/edit',
            'goal': '/goals',
            'management': '/dashboard',
            'educational': '/personas'
        }
        return route_map.get(agent_type, '/personas')
    
    def _get_transition_message(self, transition_info: Dict[str, str]) -> str:
        """Generate transition message for user"""
        to_agent = transition_info['to_agent']
        reason = transition_info.get('reason', '')
        
        if to_agent == 'goal':
            persona_name = transition_info.get('persona_name', 'your persona')
            return f"Great! Let's set some goals for {persona_name}. Moving to the goals page."
        elif to_agent == 'discovery':
            if reason == 'educational_handoff':
                return "Perfect! Now that you understand personas, let me connect you with our Discovery Agent who will help you identify and create your personal personas."
            else:
                return "Perfect! Let's discover your personal personas. Moving to the discovery page."
        elif to_agent == 'refinement':
            return "I'll help you refine your persona. Let me take you to the editing interface."
        else:
            return f"Switching to {to_agent} mode to better help you."