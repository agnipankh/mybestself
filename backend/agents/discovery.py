# agents/discovery.py - Discovery Agent implementation

import os
from typing import Dict, Any
from agents.base import BaseAgent
from conversation_models import ConversationResponse


class DiscoveryAgent(BaseAgent):
    """
    Discovery Agent specializes in helping users discover and create their personal personas.
    
    Handles intents like:
    - persona_creation: "I want to create my personas"
    - persona_discovery: "Help me find my personas"
    - role_exploration: "What roles do I play in life?"
    """
    
    @property
    def agent_type(self) -> str:
        return "discovery"
    
    @property
    def display_name(self) -> str:
        return "Discovery Agent"
    
    def get_supported_intents(self) -> list[str]:
        return [
            "persona_creation",
            "persona_discovery", 
            "role_exploration",
            "identity_clarification",
            "persona_naming",
            "northstar_creation"
        ]
    
    def generate_system_prompt(self, context: Dict[str, Any]) -> str:
        """Generate discovery system prompt for persona creation"""
        
        # Build conversation history string - use session history if available for full context
        conversation_history = ""
        history_source = context.get('session_history') or context.get('conversation_history') or []
        if history_source:
            history_lines = []
            for msg in history_source:
                from_user = msg.get('from', msg.get('from_user', 'unknown'))
                text = msg.get('text', msg.get('message', ''))
                agent_type = msg.get('agent_type', 'unknown')
                history_lines.append(f"{from_user} ({agent_type}): {text}")
            conversation_history = "\n".join(history_lines)
        
        system_prompt = f"""You are a Discovery Agent that helps users discover and create their personal personas through guided conversation.

Your role is PERSONA DISCOVERY - help users identify their roles, create personas, and craft meaningful northstars.

DISCOVERY PROCESS:
1. Ask open-ended questions about their roles, responsibilities, and passions
2. When they mention a potential persona, explore what drives them in that role
3. Help craft a northstar that captures their aspirations for that persona
4. When a persona feels complete, format it as: PERSONA_CONFIRMED: [name] | [northstar]

EXAMPLE QUESTIONS TO ASK:
- "What roles do you play in your daily life?"
- "Tell me about a role that's really important to you"
- "What does excellence look like for you as a [role]?"
- "What drives you in your [role] persona?"
- "What would your ideal [role] persona accomplish?"

PERSONA CREATION RULES:
- Only create personas when the user has clearly defined both name and northstar
- If they give a role but no northstar, ask what excellence means in that role
- If they give a northstar but no clear role, help them name the persona
- Personas should be specific roles (Parent, Creative Professional, Community Leader) not generic traits

GOAL TRANSITION DETECTION:
If the user wants to turn a persona into daily practices, goals, or actionable steps, respond with:
TRANSITION_TO_GOALS: [persona name]

Then suggest: "Great! Let me take you to the goals page for your [persona name] persona where we can create specific, measurable goals."

CONVERSATION CONTEXT:
{conversation_history}

Be encouraging, curious, and help them dig deeper into what makes each role meaningful to them. Guide them to discover 3-7 distinct personas."""

        return system_prompt
    
    async def call_openai(self, system_prompt: str, user_message: str) -> str:
        """Call OpenAI API with system prompt and user message"""
        import openai
        
        # Get API key from environment
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        
        client = openai.OpenAI(api_key=api_key)
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            raise Exception(f"OpenAI API call failed: {str(e)}")
    
    async def process_ai_response(self, ai_response: str, context: Dict[str, Any]) -> ConversationResponse:
        """Process AI response and return structured ConversationResponse"""
        
        conversation_id = context.get('conversation_id', 'unknown')
        session_id = context.get('session_id')
        previous_agent_type = context.get('previous_agent_type')
        
        # Use BaseAgent's utility method to build complete response
        return self.build_conversation_response(
            conversation_id=conversation_id,
            session_id=session_id,
            ai_response=ai_response,
            context=context,
            previous_agent_type=previous_agent_type
        )
    
    async def process_message(self, user_message: str, context: Dict[str, Any]) -> ConversationResponse:
        """
        Main entry point for processing a user message.
        
        Args:
            user_message: The user's message
            context: Conversation context including history, IDs, etc.
            
        Returns:
            ConversationResponse with AI response and any actions
        """
        # Generate system prompt
        system_prompt = self.generate_system_prompt(context)
        
        # Call OpenAI
        ai_response = await self.call_openai(system_prompt, user_message)
        
        # Process and return structured response
        return await self.process_ai_response(ai_response, context)
    
    def can_handle_intent(self, intent: str, context: Dict[str, Any]) -> bool:
        """Check if this agent can handle the given intent"""
        discovery_intents = [
            "persona_creation",
            "persona_discovery",
            "role_exploration",
            "identity_clarification",
            "persona_naming",
            "northstar_creation",
            "create_personas",
            "discover_personas",
            "find_personas"
        ]
        return intent in discovery_intents
    
    def analyze_message_for_intent(self, message: str) -> str:
        """Analyze a message to determine if it matches discovery intents"""
        msg = message.lower()
        
        if any(phrase in msg for phrase in ["create my personas", "discover my personas", "find my personas"]):
            return "persona_creation"
        elif any(phrase in msg for phrase in ["what roles", "roles do i play", "roles in life"]):
            return "role_exploration"
        elif any(phrase in msg for phrase in ["help me identify", "help me find"]):
            return "identity_clarification"
        elif any(phrase in msg for phrase in ["name this persona", "call this persona"]):
            return "persona_naming"
        elif any(phrase in msg for phrase in ["northstar for", "guiding principle"]):
            return "northstar_creation"
        else:
            return "persona_discovery"  # Default for discovery agent