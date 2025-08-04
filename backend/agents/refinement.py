# agents/refinement.py - Refinement Agent implementation

import os
from typing import Dict, Any
from agents.base import BaseAgent
from conversation_models import ConversationResponse


class RefinementAgent(BaseAgent):
    """
    Refinement Agent specializes in improving and refining existing personas.
    
    Handles intents like:
    - persona_refinement: "Improve my Creative Professional persona"
    - persona_update: "Change my northstar"
    - persona_modification: "Make my persona better"
    
    Requires target_persona_id in context to work on specific personas.
    """
    
    @property
    def agent_type(self) -> str:
        return "refinement"
    
    @property
    def display_name(self) -> str:
        return "Refinement Agent"
    
    def get_supported_intents(self) -> list[str]:
        return [
            "persona_refinement",
            "persona_update",
            "persona_modification",
            "northstar_refinement",
            "persona_improvement",
            "persona_editing"
        ]
    
    def generate_system_prompt(self, context: Dict[str, Any]) -> str:
        """Generate refinement system prompt for persona improvement"""
        
        # Build conversation history string
        conversation_history = ""
        if context.get('conversation_history'):
            history_lines = []
            for msg in context['conversation_history']:
                from_user = msg.get('from', msg.get('from_user', 'unknown'))
                text = msg.get('text', msg.get('message', ''))
                history_lines.append(f"{from_user}: {text}")
            conversation_history = "\n".join(history_lines)
        
        # Get target persona information if available
        target_persona_info = ""
        if context.get('target_persona_id'):
            target_persona_info = f"Target Persona ID: {context['target_persona_id']}"
            if context.get('target_persona'):
                persona = context['target_persona']
                target_persona_info += f"\nCurrent Persona: {persona.get('name', 'Unknown')}"
                target_persona_info += f"\nCurrent Northstar: {persona.get('north_star', 'Not defined')}"
        
        system_prompt = f"""You are a Refinement Agent that helps users improve and refine their existing personas.

Your role is PERSONA REFINEMENT - help users make their existing personas better, more specific, and more meaningful.

REFINEMENT PROCESS:
1. Understand what aspect of the persona they want to improve
2. Ask clarifying questions about their goals for this persona
3. Suggest specific improvements to name, northstar, or focus
4. When they confirm a change, format it as: REFINED_NORTHSTAR: [new northstar] OR PERSONA_CONFIRMED: [new name] | [new northstar]

REFINEMENT AREAS:
- **Name clarity**: Make persona names more specific and meaningful
- **Northstar precision**: Make northstars more actionable and inspiring  
- **Focus narrowing**: Help personas be more focused and less generic
- **Aspiration elevation**: Make northstars more aspirational and motivating

EXAMPLE REFINEMENTS:
- "Parent" → "Nurturing Parent" with northstar "To raise confident, independent children"
- Generic northstar → Specific aspiration: "Be creative" → "To express authentic creativity that inspires others"
- Vague role → Clear identity: "Worker" → "Innovative Problem Solver"

GOAL TRANSITION DETECTION:
If the user wants to turn the refined persona into goals or actionable steps, respond with:
TRANSITION_TO_GOALS: [persona name]

TARGET PERSONA CONTEXT:
{target_persona_info}

CONVERSATION CONTEXT:
{conversation_history}

Be thoughtful and help them make their personas more powerful and meaningful. Ask probing questions to understand what they really want from this persona."""

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
        # Check if we have a target persona
        if not context.get('target_persona_id'):
            # If no target persona, we should probably transition back or ask for clarification
            return ConversationResponse(
                conversation_id=context.get('conversation_id', 'unknown'),
                session_id=context.get('session_id'),
                agent_type=self.agent_type,
                user_response="I need to know which persona you'd like to refine. Could you specify which persona you want to work on?",
                database_changes={},
                agent_transition={'occurred': False},
                context_updates={}
            )
        
        # Generate system prompt
        system_prompt = self.generate_system_prompt(context)
        
        # Call OpenAI
        ai_response = await self.call_openai(system_prompt, user_message)
        
        # Process and return structured response
        return await self.process_ai_response(ai_response, context)
    
    def can_handle_intent(self, intent: str, context: Dict[str, Any]) -> bool:
        """Check if this agent can handle the given intent"""
        refinement_intents = [
            "persona_refinement",
            "persona_update",
            "persona_modification", 
            "northstar_refinement",
            "persona_improvement",
            "persona_editing",
            "refine_persona",
            "improve_persona",
            "update_persona"
        ]
        return intent in refinement_intents
    
    def analyze_message_for_intent(self, message: str) -> str:
        """Analyze a message to determine if it matches refinement intents"""
        msg = message.lower()
        
        if any(phrase in msg for phrase in ["refine", "improve", "make better"]):
            return "persona_refinement"
        elif any(phrase in msg for phrase in ["update", "change", "modify"]):
            return "persona_update"
        elif "northstar" in msg and any(phrase in msg for phrase in ["refine", "improve", "change"]):
            return "northstar_refinement"
        elif any(phrase in msg for phrase in ["edit", "fix", "adjust"]):
            return "persona_editing"
        else:
            return "persona_refinement"  # Default for refinement agent