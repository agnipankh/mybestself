# agents/educational.py - Educational Agent implementation

import os
from typing import Dict, Any
from agents.base import BaseAgent
from conversation_models import ConversationResponse


class EducationalAgent(BaseAgent):
    """
    Educational Agent specializes in explaining persona and northstar concepts.
    
    Handles intents like:
    - concept_explanation: "What is a persona?"
    - persona_education: "Give me examples of personas"
    - concept_clarification: "Explain northstar again"
    """
    
    @property
    def agent_type(self) -> str:
        return "educational"
    
    @property
    def display_name(self) -> str:
        return "Educational Agent"
    
    def get_supported_intents(self) -> list[str]:
        return [
            "concept_explanation",
            "persona_education", 
            "northstar_explanation",
            "examples_request",
            "concept_clarification"
        ]
    
    def generate_system_prompt(self, context: Dict[str, Any]) -> str:
        """Generate educational system prompt focused on explanation only"""
        
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
        
        system_prompt = f"""You are an Educational Agent that explains persona and northstar concepts clearly and concisely.

Your role is EDUCATION ONLY - you explain concepts but don't create anything.

KEY CONCEPTS TO EXPLAIN:
- A persona represents different roles/identities we embody (Parent, Professional, Creative, etc.)
- A northstar is the guiding principle that defines excellence for each persona
- Give 2-3 concrete examples: 
  * Maya Angelou as "Inspiring Writer": Northstar = "To heal and empower through authentic storytelling"
  * Serena Williams as "Champion Athlete": Northstar = "To achieve greatness through relentless dedication and grace"

TRANSITION LOGIC:
1. First, explain the concepts clearly
2. Then ASK if they want to discover their own personas (don't assume)
3. ONLY if they explicitly say YES (or similar affirmative), then respond with: TRANSITION_TO_DISCOVERY
4. If they say NO, stay in educational mode and offer to explain more concepts
5. If unclear, ask for clarification

EXAMPLES OF WHEN TO TRANSITION:
- User says: "Yes, I'd like to create my personas" → TRANSITION_TO_DISCOVERY
- User says: "That sounds great, let's do it" → TRANSITION_TO_DISCOVERY  
- User says: "No, not yet" → Stay educational, ask what else they'd like to know
- User says: "Tell me more about northstars" → Stay educational, explain more

DO NOT CREATE PERSONAS - that's the Discovery Agent's job.
DO NOT automatically transition - wait for user confirmation.

CONVERSATION CONTEXT:
{conversation_history}

Be clear, concise, and educational. Explain concepts, then wait for the user to decide their next step."""

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
                model="gpt-4o-mini",  # Using the same model as frontend
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
        educational_intents = [
            "concept_explanation",
            "persona_education",
            "northstar_explanation", 
            "examples_request",
            "concept_clarification",
            "what_is",
            "explain",
            "help_understand"
        ]
        return intent in educational_intents
    
    def analyze_message_for_intent(self, message: str) -> str:
        """Analyze a message to determine if it matches educational intents"""
        msg = message.lower()
        
        if any(phrase in msg for phrase in ["what is", "what are", "what's"]):
            return "concept_explanation"
        elif any(phrase in msg for phrase in ["explain", "help me understand"]):
            return "concept_explanation"  
        elif any(phrase in msg for phrase in ["examples", "example of", "show me"]):
            return "examples_request"
        elif "northstar" in msg or "north star" in msg:
            return "northstar_explanation"
        elif "persona" in msg and any(phrase in msg for phrase in ["what", "explain", "help"]):
            return "persona_education"
        else:
            return "concept_clarification"  # Default for educational agent