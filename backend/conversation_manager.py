# conversation_manager.py - Orchestrates agent selection and conversation flow

import re
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from conversation_models import ConversationRequest, ConversationResponse
from agents.educational import EducationalAgent
from agents.discovery import DiscoveryAgent
from agents.refinement import RefinementAgent
from agents.goal import GoalAgent
from agents.management import ManagementAgent
from models import Conversation


class ConversationManager:
    """
    Manages conversation flow and agent selection based on user intent.
    
    Responsibilities:
    - Analyze user messages to detect intent
    - Route messages to appropriate agents
    - Handle agent transitions
    - Manage conversation context and state
    """
    
    def __init__(self):
        # Register available agents
        self.agents = {
            'educational': EducationalAgent(),
            'discovery': DiscoveryAgent(),
            'refinement': RefinementAgent(), 
            'goal': GoalAgent(),
            'management': ManagementAgent()
        }
        
        # Intent patterns for routing
        self.intent_patterns = {
            # Educational intents
            'concept_explanation': [
                r'what\s+is\s+a?\s*(persona|northstar|north\s*star)',
                r'explain\s+(persona|northstar|north\s*star)',
                r'what\s+are\s+(personas|northstars|north\s*stars)',
                r'help\s+me\s+understand\s+(persona|northstar)',
                r'meaning\s+of\s+life',
                r'what.*persona.*mean',
                r'define\s+(persona|northstar)'
            ],
            
            'examples_request': [
                r'give\s+me\s+examples?\s+of\s+(persona|northstar)',
                r'show\s+me\s+examples?\s+of\s+(persona|northstar)',
                r'examples?\s+of\s+(persona|northstar)',
                r'can\s+you\s+show\s+me.*examples?'
            ],
            
            # Discovery intents (for future use)
            'persona_creation': [
                r'create\s+my\s+(persona|personas)',
                r'discover\s+my\s+(persona|personas)',
                r'find\s+my\s+(persona|personas)',
                r'identify\s+my\s+(persona|personas)',
                r'ready\s+to\s+(create|discover)',
                r'let.*s\s+(create|discover|find)\s+my',
                r'(want\s+to\s+|i\s+want\s+to\s+)?(create|discover|find)\s+(my\s+)?(persona|personas)',
                r'i\s+want\s+to\s+(create|discover|find)'
            ],
            
            # Refinement intents (for future use)
            'persona_refinement': [
                r'improve\s+my\s+.*persona',
                r'refine\s+my\s+.*persona',
                r'update\s+my\s+.*persona',
                r'change\s+my\s+.*persona',
                r'modify\s+my\s+.*persona',
                r'better.*persona'
            ],
            
            # Goal intents
            'goal_setting': [
                r'set\s+goals?\s+for',
                r'create\s+goals?\s+for',
                r'goals?\s+for\s+my\s+.*persona',
                r'turn.*into\s+goals?',
                r'actionable\s+steps',
                r'daily\s+practices'
            ],
            
            # Management intents
            'overview_request': [
                r'show\s+me\s+all\s+my\s+(personas|goals)',
                r'list\s+all\s+my\s+(personas|goals)',
                r'overview\s+of\s+my\s+(personas|goals)',
                r'dashboard',
                r'summary\s+of\s+my',
                r'all\s+my\s+(personas|goals)'
            ],
            
            'progress_review': [
                r'how\s+am\s+i\s+doing',
                r'progress\s+on\s+my',
                r'review\s+my\s+progress',
                r'check\s+my\s+progress'
            ],
            
            'strategic_planning': [
                r'what\s+should\s+i\s+focus\s+on',
                r'prioritize\s+my',
                r'strategic\s+planning',
                r'big\s+picture',
                r'long\s+term'
            ],
            
            # Affirmative responses
            'affirmative_response': [
                r'^yes$',
                r'^yeah$',
                r'^yep$',
                r'^sure$',
                r'^okay$',
                r'^ok$',
                r'yes,?\s+',
                r'that\s+sounds?\s+good',
                r'i\s*\'?d\s+like\s+that',
                r'let\s*\'?s\s+do\s+it',
                r'sounds?\s+great'
            ],
            
            # Negative responses
            'negative_response': [
                r'^no$',
                r'^nah$',
                r'^nope$',
                r'no,?\s+',
                r'not\s+yet',
                r'not\s+now',
                r'maybe\s+later',
                r'not\s+ready'
            ]
        }
    
    def analyze_intent(self, message: str, context: Dict[str, Any]) -> Tuple[str, float]:
        """
        Analyze user message to detect intent and confidence.
        
        Args:
            message: User's message
            context: Conversation context
            
        Returns:
            Tuple of (intent, confidence_score)
        """
        msg = message.lower().strip()
        
        # Check for explicit agent transitions first
        if context.get('awaiting_transition_confirmation'):
            if self._matches_patterns(msg, self.intent_patterns['affirmative_response']):
                return context.get('pending_transition', 'persona_creation'), 0.95
            elif self._matches_patterns(msg, self.intent_patterns['negative_response']):
                return 'concept_clarification', 0.90
        
        # Check each intent pattern
        for intent, patterns in self.intent_patterns.items():
            if self._matches_patterns(msg, patterns):
                confidence = self._calculate_confidence(msg, patterns)
                return intent, confidence
        
        # Default intent based on conversation history
        if context.get('conversation_history'):
            return self._infer_intent_from_context(msg, context), 0.60
        
        # Fallback to educational
        return 'concept_explanation', 0.50
    
    def _matches_patterns(self, message: str, patterns: list) -> bool:
        """Check if message matches any of the regex patterns"""
        for pattern in patterns:
            if re.search(pattern, message, re.IGNORECASE):
                return True
        return False
    
    def _calculate_confidence(self, message: str, patterns: list) -> float:
        """Calculate confidence score based on pattern matching"""
        matches = 0
        for pattern in patterns:
            if re.search(pattern, message, re.IGNORECASE):
                matches += 1
        
        # Higher confidence for more specific matches
        base_confidence = 0.70
        if matches > 1:
            base_confidence = 0.85
        if any(word in message.lower() for word in ['persona', 'northstar', 'north star']):
            base_confidence += 0.10
            
        return min(base_confidence, 0.95)
    
    def _infer_intent_from_context(self, message: str, context: Dict[str, Any]) -> str:
        """Infer intent based on conversation history"""
        history = context.get('conversation_history', [])
        
        # If last agent message asked about discovering personas
        if history:
            last_agent_msg = None
            for msg in reversed(history):
                if msg.get('from') == 'agent':
                    last_agent_msg = msg.get('text', '')
                    break
                    
            if last_agent_msg and 'discover your own personas' in last_agent_msg.lower():
                if message.lower().strip() in ['yes', 'yeah', 'sure', 'okay']:
                    return 'persona_creation'
                elif message.lower().strip() in ['no', 'not yet', 'maybe later']:
                    return 'concept_clarification'
        
        return 'concept_explanation'
    
    def select_agent(self, intent: str, context: Dict[str, Any]) -> str:
        """
        Select appropriate agent based on intent.
        
        Note: Forced agent selection is now handled in process_message()
        before this method is called.
        
        Args:
            intent: Detected user intent
            context: Conversation context
            
        Returns:
            Agent type to use
        """
        # Intent-based routing
        intent_to_agent = {
            'concept_explanation': 'educational',
            'examples_request': 'educational',
            'concept_clarification': 'educational',
            'affirmative_response': 'educational',  # Stay educational until transition confirmed
            'negative_response': 'educational',
            
            # Multi-agent routing (now active!)
            'persona_creation': 'discovery',
            'persona_refinement': 'refinement',  
            'goal_setting': 'goal',
            'overview_request': 'management',
            'progress_review': 'management',
            'strategic_planning': 'management'
        }
        
        selected_agent = intent_to_agent.get(intent, 'educational')
        
        # Ensure selected agent exists
        if selected_agent not in self.agents:
            selected_agent = 'educational'
            
        return selected_agent
    
    async def process_message(
        self, 
        request: ConversationRequest, 
        db: Session
    ) -> ConversationResponse:
        """
        Main entry point for processing user messages.
        
        Args:
            request: Conversation request
            db: Database session
            
        Returns:
            Conversation response with agent output
        """
        try:
            # Check for forced agent first - determine target agent type
            forced_agent = request.agent_context.get('force_agent_type') if request.agent_context else None
            
            if forced_agent and forced_agent in self.agents:
                # BYPASS intent analysis - agent is explicitly forced
                agent_type = forced_agent
                intent = f"forced_{forced_agent}"
                confidence = 1.0
                print(f"⚡ Bypassing intent analysis - forced agent: {forced_agent}")
            else:
                # For intent analysis, we need basic context, so load current conversation first
                if request.conversation_id:
                    current_conversation = db.query(Conversation).filter(
                        Conversation.id == request.conversation_id
                    ).first()
                else:
                    current_conversation = None
                
                # Build minimal context for intent analysis
                temp_context = self._build_session_context(current_conversation, request, db)
                
                # Normal intent analysis and agent selection
                intent, confidence = self.analyze_intent(request.message, temp_context)
                agent_type = self.select_agent(intent, temp_context)
                print(f"🧠 Intent analysis: '{request.message}' → {intent} ({confidence:.2f}) → {agent_type}")
            
            # Determine if we need a new conversation (agent transition)
            if request.conversation_id:
                current_conversation = db.query(Conversation).filter(
                    Conversation.id == request.conversation_id
                ).first()
                
                if current_conversation and current_conversation.agent_type != agent_type:
                    # AGENT TRANSITION - Create new conversation!
                    print(f"🔄 Agent transition: {current_conversation.agent_type} → {agent_type}")
                    conversation = await self._create_new_conversation_for_transition(
                        current_conversation, agent_type, request, db
                    )
                    agent_transitioned = True
                    previous_agent = current_conversation.agent_type
                else:
                    # Continue existing conversation
                    conversation = current_conversation or await self._create_first_conversation(request, agent_type, db)
                    agent_transitioned = False
                    previous_agent = None
            else:
                # No conversation_id provided - create first conversation
                conversation = await self._create_first_conversation(request, agent_type, db)
                agent_transitioned = False
                previous_agent = None
            
            # Build full context with session history
            context = self._build_session_context(conversation, request, db)
            context.update({
                'detected_intent': intent,
                'intent_confidence': confidence,
                'selected_agent': agent_type
            })
            
            # Process message with selected agent
            agent = self.agents[agent_type]
            response = await agent.process_message(request.message, context)
            
            # Update response with intent and conversation information
            response.conversation_id = str(conversation.id)
            response.intent = intent
            response.intent_confidence = confidence
            
            # Set agent transition information if transition occurred
            if agent_transitioned:
                response.agent_transition.occurred = True
                response.agent_transition.from_agent = previous_agent
                response.agent_transition.to_agent = agent_type
                response.agent_transition.reason = f"agent_change_{intent}"
                response.agent_transition.transition_message = f"Created new conversation (ID: {conversation.id}) for {agent_type} agent based on intent: {intent}"
            
            # Handle explicit agent transitions if needed (from AI commands)
            response = await self._handle_agent_transitions(response, context, db)
            
            # Save conversation to database
            await self._save_conversation(conversation, request, response, db)
            
            return response
            
        except Exception as e:
            raise Exception(f"ConversationManager error: {str(e)}")
    
    async def _load_or_create_conversation(
        self, 
        conversation_id: str, 
        request: ConversationRequest, 
        db: Session
    ) -> Conversation:
        """Load existing conversation or create new one"""
        if request.conversation_id:
            # Load existing conversation
            conversation = db.query(Conversation).filter(
                Conversation.id == request.conversation_id
            ).first()
            if not conversation:
                raise Exception("Conversation not found")
        else:
            # Create new conversation
            conversation = Conversation(
                id=conversation_id,
                user_id=request.user_id,
                session_id=request.session_id,
                conversation_type='agent_conversation',
                topic='MyBestSelf Agent Conversation',
                agent_type='educational',
                messages=[],
                context_state={},
                started_at=datetime.utcnow(),
                last_activity_at=datetime.utcnow()
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            
        return conversation
    
    async def _create_first_conversation(self, request: ConversationRequest, agent_type: str, db: Session) -> Conversation:
        """Create the first conversation in a session"""
        conversation = Conversation(
            id=str(self._generate_uuid()),
            user_id=request.user_id,
            session_id=request.session_id,
            conversation_type='agent_conversation',
            topic=f'MyBestSelf {agent_type.title()} Agent Conversation',
            agent_type=agent_type,
            messages=[],
            context_state={},
            started_at=datetime.utcnow(),
            last_activity_at=datetime.utcnow()
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        print(f"📝 Created first conversation (ID: {conversation.id}) for {agent_type} agent")
        return conversation
    
    async def _create_new_conversation_for_transition(
        self, 
        previous_conversation: Conversation, 
        new_agent_type: str, 
        request: ConversationRequest, 
        db: Session
    ) -> Conversation:
        """Create a new conversation when agent transitions occur"""
        conversation = Conversation(
            id=str(self._generate_uuid()),
            user_id=request.user_id,
            session_id=request.session_id,  # Same session, new conversation
            conversation_type='agent_conversation',
            topic=f'MyBestSelf {new_agent_type.title()} Agent Conversation',
            agent_type=new_agent_type,
            messages=[],
            context_state={},
            started_at=datetime.utcnow(),
            last_activity_at=datetime.utcnow()
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        print(f"🆕 Created new conversation (ID: {conversation.id}) for agent transition: {previous_conversation.agent_type} → {new_agent_type}")
        return conversation
    
    def _build_session_context(self, current_conversation: Conversation, request: ConversationRequest, db: Session) -> Dict[str, Any]:
        """Build context dictionary with full session history for agents"""
        # Get all conversations in this session for full context
        session_conversations = []
        if request.session_id:
            all_conversations = db.query(Conversation).filter(
                Conversation.session_id == request.session_id,
                Conversation.user_id == request.user_id
            ).order_by(Conversation.started_at).all()
            
            # Build full session message history
            for conv in all_conversations:
                if conv.messages:
                    session_conversations.extend(conv.messages)
        
        # Current conversation messages (if any)
        current_messages = current_conversation.messages if current_conversation else []
        
        return {
            'conversation_id': str(current_conversation.id) if current_conversation else None,
            'session_id': request.session_id,
            'user_id': request.user_id,
            'target_persona_id': request.target_persona_id,
            'target_goal_id': request.target_goal_id,
            'conversation_history': current_messages,  # Current conversation only
            'session_history': session_conversations,   # Full session across all conversations
            'temporary_state': request.agent_context.get('temporary_state', {}) if request.agent_context else {},
            'current_agent_type': current_conversation.agent_type if current_conversation else None,
            'requested_agent': request.agent_context.get('force_agent_type') if request.agent_context else None
        }
    
    async def _handle_agent_transitions(
        self, 
        response: ConversationResponse, 
        context: Dict[str, Any], 
        db: Session
    ) -> ConversationResponse:
        """Handle agent transitions and route to new agents if needed"""
        
        if response.agent_transition.occurred:
            target_agent = response.agent_transition.to_agent
            
            # For now, only educational agent is available
            # In Step 7, we'll actually transition to other agents
            if target_agent not in self.agents:
                # Add note that transition would occur when agent is available
                response.agent_transition.transition_message += f" (Note: {target_agent} agent will be available soon)"
                response.agent_transition.occurred = False  # Don't actually transition yet
        
        return response
    
    async def _save_conversation(
        self, 
        conversation: Conversation, 
        request: ConversationRequest, 
        response: ConversationResponse, 
        db: Session
    ):
        """Save conversation messages and updates to database"""
        
        # Process database changes first (personas, goals, etc.)
        await self._process_database_changes(response.database_changes, request.user_id, db)
        
        # Update messages
        updated_messages = conversation.messages or []
        
        # Add user message
        user_message = {
            'id': f"msg-{datetime.utcnow().timestamp()}-user",
            'from': 'user',
            'text': request.message,
            'timestamp': datetime.utcnow().isoformat(),
            'agent_type': response.agent_type
        }
        updated_messages.append(user_message)
        
        # Add agent response
        agent_message = {
            'id': f"msg-{datetime.utcnow().timestamp()}-agent",
            'from': 'agent', 
            'text': response.user_response,
            'timestamp': datetime.utcnow().isoformat(),
            'agent_type': response.agent_type
        }
        updated_messages.append(agent_message)
        
        # Update conversation
        conversation.messages = updated_messages
        conversation.last_activity_at = datetime.utcnow()
        conversation.agent_type = response.agent_type
        if response.intent:
            conversation.intent = response.intent
            conversation.intent_confidence = response.intent_confidence
            
        db.commit()
    
    async def _process_database_changes(
        self,
        database_changes: 'DatabaseChanges',
        user_id: str,
        db: Session
    ):
        """Process database changes from agent responses (create personas, goals, etc.)"""
        from models import Persona, Goal
        from uuid import UUID
        
        # Create personas
        if database_changes and database_changes.personas_created:
            for persona_action in database_changes.personas_created:
                print(f"🆕 Creating persona: {persona_action.get('name')} | {persona_action.get('north_star')}")
                
                # Create new persona record
                new_persona = Persona(
                    user_id=UUID(user_id),
                    label=persona_action.get('name'),
                    north_star=persona_action.get('north_star'),
                    is_calling=False,  # Default value
                    importance=3  # Default importance
                )
                
                db.add(new_persona)
                print(f"✅ Added persona '{new_persona.label}' to database session")
        
        # Create goals  
        if database_changes and database_changes.goals_created:
            for goal_action in database_changes.goals_created:
                print(f"🎯 Creating goal: {goal_action.get('name')}")
                
                # Create new goal record
                new_goal = Goal(
                    user_id=UUID(user_id),
                    name=goal_action.get('name'),
                    acceptance_criteria=goal_action.get('acceptance_criteria'),
                    review_date=datetime.utcnow(),  # Default to now, can be refined later
                    planned_hours=0,
                    actual_hours=0
                )
                
                db.add(new_goal)
                print(f"✅ Added goal '{new_goal.name}' to database session")
        
        # Commit database changes
        if (database_changes and 
            (database_changes.personas_created or database_changes.goals_created)):
            print("💾 Committing database changes...")
            db.commit()
            print("✅ Database changes committed successfully")
    
    def _generate_uuid(self) -> str:
        """Generate a new UUID"""
        from uuid import uuid4
        return str(uuid4())
    
    def get_available_agents(self) -> list:
        """Return list of available agent types"""
        return list(self.agents.keys())
    
    def get_agent_info(self, agent_type: str) -> Dict[str, Any]:
        """Get information about a specific agent"""
        if agent_type not in self.agents:
            raise ValueError(f"Agent type {agent_type} not found")
            
        agent = self.agents[agent_type]
        return {
            'type': agent.agent_type,
            'display_name': agent.display_name,
            'supported_intents': agent.get_supported_intents()
        }