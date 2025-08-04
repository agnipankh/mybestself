# agents/management.py - Management Agent implementation

import os
from typing import Dict, Any
from agents.base import BaseAgent
from conversation_models import ConversationResponse


class ManagementAgent(BaseAgent):
    """
    Management Agent specializes in providing overview and managing existing personas and goals.
    
    Handles intents like:
    - overview_request: "Show me all my personas"
    - progress_review: "How am I doing with my goals?"
    - prioritization: "Help me prioritize my personas"
    - strategic_planning: "What should I focus on?"
    """
    
    @property
    def agent_type(self) -> str:
        return "management"
    
    @property
    def display_name(self) -> str:
        return "Management Agent"
    
    def get_supported_intents(self) -> list[str]:
        return [
            "overview_request",
            "progress_review",
            "prioritization",
            "strategic_planning",
            "dashboard_view",
            "persona_management",
            "goal_overview"
        ]
    
    def generate_system_prompt(self, context: Dict[str, Any]) -> str:
        """Generate management system prompt for overview and strategic guidance"""
        
        # Build conversation history string
        conversation_history = ""
        if context.get('conversation_history'):
            history_lines = []
            for msg in context['conversation_history']:
                from_user = msg.get('from', msg.get('from_user', 'unknown'))
                text = msg.get('text', msg.get('message', ''))
                history_lines.append(f"{from_user}: {text}")
            conversation_history = "\n".join(history_lines)
        
        # Get user personas and goals info (would be loaded from database in real implementation)
        user_data_info = ""
        if context.get('user_personas'):
            user_data_info += f"User has {len(context['user_personas'])} personas defined."
        if context.get('user_goals'):
            user_data_info += f" User has {len(context['user_goals'])} active goals."
        
        system_prompt = f"""You are a Management Agent that provides strategic overview and helps users manage their personas and goals effectively.

Your role is STRATEGIC MANAGEMENT - help users see the big picture, prioritize effectively, and make strategic decisions about their personal development.

MANAGEMENT CAPABILITIES:
1. **Overview**: Provide high-level view of all personas and goals
2. **Prioritization**: Help users focus on what matters most
3. **Progress Review**: Analyze progress across personas and goals  
4. **Strategic Planning**: Guide long-term personal development strategy
5. **Balance Assessment**: Help ensure balanced development across life areas

MANAGEMENT INSIGHTS TO PROVIDE:
- **Portfolio view**: How their personas work together
- **Priority guidance**: Which personas/goals need most attention
- **Balance check**: Are they neglecting important life areas?
- **Progress patterns**: What's working well vs. what needs adjustment
- **Strategic recommendations**: Next steps for growth

TRANSITION CAPABILITIES:
- If they want to work on a specific persona: TRANSITION_TO_REFINEMENT: [persona_id]
- If they want to set goals for a persona: TRANSITION_TO_GOALS: [persona name]
- If they want to discover new personas: TRANSITION_TO_DISCOVERY

RESPONSE STYLE:
- Be strategic and thoughtful
- Provide actionable insights
- Ask clarifying questions about priorities
- Help them see patterns and opportunities
- Guide toward balanced development

USER DATA CONTEXT:
{user_data_info}

CONVERSATION CONTEXT:
{conversation_history}

Help them manage their personal development journey strategically and holistically."""

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
        management_intents = [
            "overview_request",
            "progress_review",
            "prioritization",
            "strategic_planning",
            "dashboard_view",
            "persona_management", 
            "goal_overview",
            "show_all",
            "manage_personas",
            "strategic_review"
        ]
        return intent in management_intents
    
    def analyze_message_for_intent(self, message: str) -> str:
        """Analyze a message to determine if it matches management intents"""
        msg = message.lower()
        
        if any(phrase in msg for phrase in ["show me all", "overview", "dashboard", "summary"]):
            return "overview_request"
        elif any(phrase in msg for phrase in ["how am i doing", "progress", "review"]):
            return "progress_review"
        elif any(phrase in msg for phrase in ["prioritize", "focus on", "what should i"]):
            return "prioritization" 
        elif any(phrase in msg for phrase in ["strategic", "long term", "big picture"]):
            return "strategic_planning"
        elif any(phrase in msg for phrase in ["manage", "organize", "coordinate"]):
            return "persona_management"
        else:
            return "overview_request"  # Default for management agent