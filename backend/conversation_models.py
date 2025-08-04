# conversation_models.py - Pydantic models for conversation API

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
from uuid import UUID


class AgentType(str, Enum):
    """Available agent types for conversation handling"""
    EDUCATIONAL = "educational"
    DISCOVERY = "discovery" 
    REFINEMENT = "refinement"
    MANAGEMENT = "management"
    GOAL = "goal"


class ConversationRequest(BaseModel):
    """Request model for conversation processing"""
    user_id: str = Field(..., description="UUID of the user")
    message: str = Field(..., description="User's message to process")
    session_id: Optional[str] = Field(None, description="Session ID to group related conversations")
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID, creates new if not provided")
    target_persona_id: Optional[str] = Field(None, description="Target persona ID for refinement/goal agents")
    target_goal_id: Optional[str] = Field(None, description="Target goal ID for goal management")
    agent_context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional agent context")


class PersonaAction(BaseModel):
    """Action to be taken on a persona"""
    type: str = Field(..., description="Action type: create, update, delete")
    id: Optional[str] = Field(None, description="Persona ID for update/delete")
    name: str = Field(..., description="Persona name")
    north_star: Optional[str] = Field(None, description="Persona north star/guiding principle")
    importance: Optional[int] = Field(None, description="Importance level 1-5")
    previous_values: Optional[Dict[str, Any]] = Field(None, description="Previous values for update tracking")


class GoalAction(BaseModel):
    """Action to be taken on a goal"""
    type: str = Field(..., description="Action type: create, update, delete")
    id: Optional[str] = Field(None, description="Goal ID for update/delete")
    name: str = Field(..., description="Goal name")
    acceptance_criteria: Optional[str] = Field(None, description="Goal acceptance criteria")
    review_date: Optional[str] = Field(None, description="Goal review date (YYYY-MM-DD)")
    persona_id: Optional[str] = Field(None, description="Associated persona ID")
    previous_values: Optional[Dict[str, Any]] = Field(None, description="Previous values for update tracking")


class DatabaseChanges(BaseModel):
    """Summary of database changes made during conversation processing"""
    personas_created: List[PersonaAction] = Field(default_factory=list)
    personas_updated: List[PersonaAction] = Field(default_factory=list)
    personas_deleted: List[PersonaAction] = Field(default_factory=list)
    goals_created: List[GoalAction] = Field(default_factory=list)
    goals_updated: List[GoalAction] = Field(default_factory=list)
    goals_deleted: List[GoalAction] = Field(default_factory=list)


class AgentTransition(BaseModel):
    """Information about agent transitions during conversation"""
    occurred: bool = Field(..., description="Whether a transition occurred")
    from_agent: Optional[str] = Field(None, description="Previous agent type")
    to_agent: Optional[str] = Field(None, description="New agent type")
    reason: Optional[str] = Field(None, description="Reason for transition: user_intent_change, explicit_request, action_triggered")
    suggested_route: Optional[str] = Field(None, description="Suggested frontend route for navigation")
    transition_message: Optional[str] = Field(None, description="Message explaining the transition to user")
    context_data: Optional[Dict[str, Any]] = Field(None, description="Additional context data for transition")


class ContextUpdates(BaseModel):
    """Updates to conversation context"""
    current_agent_type: Optional[str] = Field(None, description="Current agent handling conversation")
    target_persona_id: Optional[str] = Field(None, description="Target persona ID if set")
    target_goal_id: Optional[str] = Field(None, description="Target goal ID if set")
    temporary_state: Optional[Dict[str, Any]] = Field(None, description="Agent-specific temporary state")
    intent: Optional[str] = Field(None, description="Detected user intent")
    intent_confidence: Optional[float] = Field(None, description="Confidence score for intent detection")


class ConversationResponse(BaseModel):
    """Response model for conversation processing"""
    conversation_id: str = Field(..., description="ID of the conversation")
    session_id: Optional[str] = Field(None, description="Session ID grouping related conversations")
    agent_type: str = Field(..., description="Agent type that handled this message")
    previous_agent_type: Optional[str] = Field(None, description="Previous agent type if transition occurred")
    intent: Optional[str] = Field(None, description="Detected user intent")
    intent_confidence: float = Field(0.0, description="Confidence score for intent detection")
    user_response: str = Field(..., description="Response message for the user")
    database_changes: DatabaseChanges = Field(default_factory=DatabaseChanges, description="Database changes made")
    agent_transition: AgentTransition = Field(default_factory=lambda: AgentTransition(occurred=False), description="Agent transition information")
    context_updates: ContextUpdates = Field(default_factory=ContextUpdates, description="Context updates")


# Supporting models for other endpoints

class ConversationContext(BaseModel):
    """Current conversation context"""
    conversation_id: str
    session_id: Optional[str] = None
    current_agent_type: str
    target_persona_id: Optional[str] = None
    target_goal_id: Optional[str] = None
    temporary_state: Dict[str, Any] = Field(default_factory=dict)
    intent: Optional[str] = None
    intent_confidence: float = 0.0
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)


class ContextUpdate(BaseModel):
    """Update conversation context"""
    current_agent_type: Optional[str] = None
    target_persona_id: Optional[str] = None
    target_goal_id: Optional[str] = None
    temporary_state: Optional[Dict[str, Any]] = None


class SetTargetPersonaRequest(BaseModel):
    """Request to set target persona for conversation"""
    persona_id: str = Field(..., description="UUID of the persona to target")
    agent_type: str = Field(..., description="Agent type to switch to (refinement or goal)")


class IntentAnalysisRequest(BaseModel):
    """Request for intent analysis"""
    message: str = Field(..., description="Message to analyze")
    current_context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Current conversation context")


class IntentAnalysisResponse(BaseModel):
    """Response for intent analysis"""
    intent: str = Field(..., description="Detected intent")
    suggested_agent: str = Field(..., description="Suggested agent for this intent")
    confidence: float = Field(..., description="Confidence score 0.0-1.0")
    reasoning: str = Field(..., description="Explanation of why this intent was detected")


class ConversationMessage(BaseModel):
    """Individual conversation message"""
    id: str
    from_user: str  # 'user' or 'agent'
    text: str
    timestamp: datetime
    agent_type: str


class ConversationHistory(BaseModel):
    """Conversation history response"""
    conversation_id: str
    session_id: Optional[str] = None
    messages: List[ConversationMessage]
    total_messages: int