// services/conversation/ConversationManager.ts - Enhanced with RefinementAgent

import { EducationalAgent, DiscoveryAgent, RefinementAgent, BaseAgent, ManagementAgent, GoalAgent} from './agents'
import { ConversationContext, AgentType, AgentResult } from './ConversationContext'
import { ChatMessage } from '@/types/chat'

export class ConversationManager {
  private agents: Map<AgentType, BaseAgent>
  private context: ConversationContext
  private apiEndpoint: string

  constructor(apiEndpoint: string = '/api/openai-chat') {
    this.apiEndpoint = apiEndpoint
    
    // Register all available agents
    this.agents = new Map([
      [AgentType.EDUCATIONAL, new EducationalAgent()],
      [AgentType.DISCOVERY, new DiscoveryAgent()],
      [AgentType.REFINEMENT, new RefinementAgent()],
      [AgentType.MANAGEMENT, new ManagementAgent()],
      [AgentType.GOAL, new GoalAgent()],
    ])
    
    // Validate all agent types are covered (development safety check)
    this.validateAgentCoverage()
    
    this.context = {
      currentAgentType: AgentType.EDUCATIONAL, // Start with education
      temporaryState: {},
      conversationHistory: [],
      lastIntentConfidence: 0
    }
  }

  /**
   * Development helper to ensure all AgentTypes have implementations
   */
  private validateAgentCoverage(): void {
    const registeredTypes = Array.from(this.agents.keys())
    const allTypes = Object.values(AgentType)
    
    const missingTypes = allTypes.filter(type => !registeredTypes.includes(type))
    
    if (missingTypes.length > 0) {
      console.warn('⚠️ Missing agent implementations for:', missingTypes)
    } // else {
      //console.log('✅ All agent types are properly registered:', registeredTypes)
    //}
  }

  async processMessage(userMessage: string): Promise<AgentResult> {
    try {
      // 1. Analyze intent and potentially switch agents
      const newAgentType = this.analyzeIntent(userMessage)
      if (newAgentType !== this.context.currentAgentType) {
        this.context.currentAgentType = newAgentType
        console.log(`🔄 Switched to ${newAgentType} agent`)
      }

      // 2. Get current agent with robust error handling
      const agent = this.agents.get(this.context.currentAgentType)
      if (!agent) {
        console.error(`❌ No agent found for type: ${this.context.currentAgentType}`)
        return this.handleMissingAgent(userMessage)
      }

      // 3. Process with the selected agent
      return await this.processWithAgent(agent, userMessage)
      
    } catch (error) {
      console.error('❌ Error in processMessage:', error)
      return this.handleProcessingError(error as Error, userMessage)
    }
  }

  private async processWithAgent(agent: BaseAgent, userMessage: string): Promise<AgentResult> {
    // Generate system prompt
    const systemPrompt = agent.generateSystemPrompt(this.context)
    
    // Call AI
    const aiResponse = await this.callAI(systemPrompt, userMessage)
    
    // Let agent process response
    const result = agent.processResponse(aiResponse, this.context)
    
    // Update context
    this.context = {
      ...this.context,
      ...result.contextUpdates,
      conversationHistory: [
        ...this.context.conversationHistory,
        { id: this.generateId(), from: 'user', text: userMessage, timestamp: new Date() },
        { id: this.generateId(), from: 'coach', text: result.userResponse, timestamp: new Date() }
      ]
    }
    
    return result
  }

  private handleMissingAgent(userMessage: string): AgentResult {
    // Fallback to Discovery agent if available, otherwise Educational
    const fallbackAgent = this.agents.get(AgentType.DISCOVERY) || this.agents.get(AgentType.EDUCATIONAL)
    
    if (!fallbackAgent) {
      throw new Error('Critical: No fallback agents available')
    }

    console.log(`🔄 Falling back to ${fallbackAgent.type} agent`)
    this.context.currentAgentType = fallbackAgent.type
    
    return {
      userResponse: "I'm having trouble understanding your request right now. Let me help you with persona discovery instead. What would you like to explore about yourself?",
      personaActions: [],
      contextUpdates: {}
    }
  }

  private handleProcessingError(error: Error, userMessage: string): AgentResult {
    return {
      userResponse: `I apologize, but I encountered an error processing your message. Could you try rephrasing your question? (Error: ${error.message})`,
      personaActions: [],
      contextUpdates: {}
    }
  }

  private analyzeIntent(userMessage: string): AgentType {
    const msg = userMessage.toLowerCase()
    
    // Goal keywords - goal setting and management
    if (msg.includes('goal') || msg.includes('achieve') || 
        msg.includes('target') || msg.includes('accomplish') ||
        msg.includes('track') || msg.includes('progress') ||
        msg.includes('review') || msg.includes('measure')) {
      return AgentType.GOAL
    }
    
    // Educational keywords - learning about concepts
    if (msg.includes('what is') || msg.includes('what are') || 
        msg.includes('explain') || msg.includes('examples') ||
        msg.includes('help me understand')) {
      return AgentType.EDUCATIONAL
    }
    
    // Discovery keywords - finding new personas
    if (msg.includes('ready') || msg.includes('create') || 
        msg.includes('discover') || msg.includes('my own') ||
        msg.includes('identify') || msg.includes('find my')) {
      return AgentType.DISCOVERY
    }
    
    // Refinement keywords - improving existing personas  
    if (msg.includes('refine') || msg.includes('change') || 
        msg.includes('better') || msg.includes('improve') ||
        msg.includes('update') || msg.includes('modify') ||
        msg.includes('fix') || this.context.targetPersonaId) {
      return AgentType.REFINEMENT
    }
    
    // Default: stay with current agent unless it's undefined
    const currentAgent = this.agents.get(this.context.currentAgentType)
    return currentAgent ? this.context.currentAgentType : AgentType.EDUCATIONAL
  }

  private async callAI(systemPrompt: string, userMessage: string): Promise<string> {
    const messages = [
      { from: 'system', text: systemPrompt },
      ...this.context.conversationHistory,
      { from: 'user', text: userMessage }
    ]

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    })

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    if (!data.reply) {
      throw new Error('No reply received from AI service')
    }
    
    return data.reply
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  getContext(): ConversationContext {
    return { ...this.context }
  }

  /**
   * Manually set target persona for refinement
   */
  setTargetPersona(personaId: string): void {
    this.context.targetPersonaId = personaId
    this.context.currentAgentType = AgentType.REFINEMENT
    console.log(`🎯 Targeted persona ${personaId} for refinement`)
  }

  /**
   * Set target persona with full persona object for goal setting
   */
  setTargetPersonaForGoals(persona: any): void {
    this.context.targetPersonaId = persona.id
    this.context.targetPersona = persona
    this.context.currentAgentType = AgentType.GOAL
    // Clear any existing conversation history to start fresh
    this.context.conversationHistory = []
    console.log(`🎯 Targeted persona ${persona.name} for goal setting`)
  }

  /**
   * Clear target persona
   */
  clearTargetPersona(): void {
    this.context.targetPersonaId = undefined
    console.log('🎯 Cleared target persona')
  }
}
