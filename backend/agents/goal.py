# agents/goal.py - Goal Agent implementation

import os
from typing import Dict, Any
from agents.base import BaseAgent
from conversation_models import ConversationResponse


class GoalAgent(BaseAgent):
    """
    Goal Agent specializes in creating and managing goals for personas.
    
    Handles intents like:
    - goal_setting: "Set goals for my Creative Professional persona"
    - goal_creation: "Create goals for this persona"
    - actionable_planning: "Turn my persona into actionable steps"
    
    Requires target_persona_id in context to create goals for specific personas.
    """
    
    @property
    def agent_type(self) -> str:
        return "goal"
    
    @property
    def display_name(self) -> str:
        return "Goal Agent"
    
    def get_supported_intents(self) -> list[str]:
        return [
            "goal_setting",
            "goal_creation",
            "actionable_planning",
            "goal_management",
            "progress_tracking",
            "goal_refinement"
        ]
    
    def generate_system_prompt(self, context: Dict[str, Any]) -> str:
        """Generate goal system prompt for creating actionable goals"""
        
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
                target_persona_info += f"\nPersona: {persona.get('name', 'Unknown')}"
                target_persona_info += f"\nNorthstar: {persona.get('north_star', 'Not defined')}"
        
        system_prompt = f"""You are a Goal Agent that helps users create specific, measurable goals for their personas.

Your role is GOAL CREATION - help users turn their persona aspirations into concrete, actionable goals.

GOAL CREATION PROCESS:
1. Understand the persona and its northstar
2. Help create SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
3. Set appropriate review dates (usually weekly or monthly)
4. Define clear acceptance criteria for success
5. When a goal is ready, format it as: GOAL_CREATED: [goal name] | [acceptance criteria] | [review date]

GOAL CHARACTERISTICS:
- **Specific**: Clear and well-defined actions
- **Measurable**: Can track progress objectively  
- **Achievable**: Realistic given their situation
- **Relevant**: Aligned with the persona's northstar
- **Time-bound**: Has a clear review/completion date

EXAMPLE GOALS:
For "Creative Professional" with northstar "To express authentic creativity":
- GOAL_CREATED: Write 1000 words daily | Complete 1000 words of creative writing each morning by 9am | 2024-01-15
- GOAL_CREATED: Share creative work weekly | Post one piece of creative work on social media every Friday | 2024-01-15

GOAL TYPES TO CONSIDER:
- **Daily practices**: Regular habits that build the persona
- **Weekly objectives**: Larger tasks done regularly  
- **Monthly milestones**: Significant achievements
- **Project goals**: Specific creative or professional projects

TARGET PERSONA CONTEXT:
{target_persona_info}

CONVERSATION CONTEXT:
{conversation_history}

Help them create 2-4 concrete goals that will move them toward their persona's northstar. Ask clarifying questions about their current situation and what's realistic for them."""

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
            # If no target persona, we should ask which persona they want to set goals for
            return ConversationResponse(
                conversation_id=context.get('conversation_id', 'unknown'),
                session_id=context.get('session_id'),
                agent_type=self.agent_type,
                user_response="I'd love to help you set goals! Which persona would you like to create goals for? Please let me know the persona name or describe the role you want to focus on.",
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
        goal_intents = [
            "goal_setting",
            "goal_creation", 
            "actionable_planning",
            "goal_management",
            "progress_tracking",
            "goal_refinement",
            "create_goals",
            "set_goals",
            "plan_actions"
        ]
        return intent in goal_intents
    
    def analyze_message_for_intent(self, message: str) -> str:
        """Analyze a message to determine if it matches goal intents"""
        msg = message.lower()
        
        if any(phrase in msg for phrase in ["set goals", "create goals", "goals for"]):
            return "goal_setting"
        elif any(phrase in msg for phrase in ["actionable steps", "daily practices", "turn into"]):
            return "actionable_planning"
        elif any(phrase in msg for phrase in ["track progress", "review goals", "check progress"]):
            return "progress_tracking"
        elif any(phrase in msg for phrase in ["manage goals", "organize goals"]):
            return "goal_management"
        elif any(phrase in msg for phrase in ["improve goals", "refine goals", "better goals"]):
            return "goal_refinement"
        else:
            return "goal_creation"  # Default for goal agent