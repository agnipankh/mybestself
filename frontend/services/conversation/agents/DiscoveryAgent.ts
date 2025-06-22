// services/conversation/agents/DiscoveryAgent.ts
import { BaseAgent } from './BaseAgent'
import { ConversationContext, AgentResult, AgentType, PersonaAction } from '../ConversationContext'

export class DiscoveryAgent extends BaseAgent {
  readonly type = AgentType.DISCOVERY

  canHandle(userMessage: string, context: ConversationContext): boolean {
    const msg = userMessage.toLowerCase()
    return msg.includes('ready') || msg.includes('discover') || msg.includes('create') || msg.includes('my own')
  }

  generateSystemPrompt(context: ConversationContext): string {
    return `You are helping a user discover their personal personas through conversation.

Your goal: Help them identify 3-7 distinct personas and craft meaningful northstars.

Process:
1. Ask open-ended questions about their roles, responsibilities, and passions
2. When they mention a potential persona, explore what drives them in that role
3. Help craft a northstar that captures their aspirations for that persona
4. When a persona feels complete, format it as: PERSONA_CONFIRMED: [name] | [northstar]

Current conversation context:
${context.temporaryState.draftPersonas ? 
  `Draft personas in progress: ${JSON.stringify(context.temporaryState.draftPersonas)}` : 
  'Just starting discovery'
}

Be encouraging and help them think deeply about what matters to them.`
  }

  processResponse(aiResponse: string, context: ConversationContext): AgentResult {
    const personaActions = this.parsePersonaActions(aiResponse)
    const cleanResponse = this.cleanResponseForUser(aiResponse)
    
    return {
      userResponse: cleanResponse,
      personaActions,
      contextUpdates: {}
    }
  }

  private parsePersonaActions(response: string): PersonaAction[] {
    const actions: PersonaAction[] = []
    const regex = /PERSONA_CONFIRMED:\s*([^|]+)\|\s*([^\n]+)/gi
    
    let match
    while ((match = regex.exec(response)) !== null) {
      actions.push({
        type: 'create',
        name: match[1].trim(),
        northStar: match[2].trim()
      })
    }
    
    return actions
  }
}
