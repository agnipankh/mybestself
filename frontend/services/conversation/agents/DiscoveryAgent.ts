// services/conversation/agents/DiscoveryAgent.ts
import { BaseAgent } from './BaseAgent'
import { ConversationContext, AgentResult, AgentType, PersonaAction, TransitionAction } from '../ConversationContext'

export class DiscoveryAgent extends BaseAgent {
  readonly type = AgentType.DISCOVERY

  canHandle(userMessage: string, context: ConversationContext): boolean {
    const msg = userMessage.toLowerCase()
    return msg.includes('ready') || msg.includes('discover') || msg.includes('create') || msg.includes('my own')
  }

  generateSystemPrompt(context: ConversationContext): string {
    const conversationHistory = context.conversationHistory.map(msg => `${msg.from}: ${msg.text}`).join('\n')
    
    return `You are helping a user discover their personal personas through conversation.

Your goal: Help them identify 3-7 distinct personas and craft meaningful northstars.

Process:
1. Ask open-ended questions about their roles, responsibilities, and passions
2. When they mention a potential persona, explore what drives them in that role
3. Help craft a northstar that captures their aspirations for that persona
4. When a persona feels complete, format it as: PERSONA_CONFIRMED: [name] | [northstar]

GOAL TRANSITION DETECTION:
If the user wants to turn a persona into daily practices, goals, or actionable steps, respond with:
TRANSITION_TO_GOALS: [persona name]

Then suggest they move to the goals page: "Great! Let me take you to the goals page for your [persona name] persona where we can create specific, measurable goals and track your progress."

Examples of goal transition triggers:
- "turn this into daily practices"
- "make this actionable" 
- "set goals for this persona"
- "what should I do daily"
- "how do I implement this"
- "yes" (when previously offering to help with daily practices)

Current conversation context:
${context.temporaryState.draftPersonas ? 
  `Draft personas in progress: ${JSON.stringify(context.temporaryState.draftPersonas)}` : 
  'Just starting discovery'
}

CONVERSATION HISTORY:
${conversationHistory}

Be encouraging and help them think deeply about what matters to them.`
  }

  processResponse(aiResponse: string, context: ConversationContext): AgentResult {
    const personaActions = this.parsePersonaActions(aiResponse)
    const transitionActions = this.parseTransitionActions(aiResponse)
    const cleanResponse = this.cleanResponseForUser(aiResponse)
    
    return {
      userResponse: cleanResponse,
      personaActions,
      transitionActions,
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

  private parseTransitionActions(response: string): TransitionAction[] {
    const actions: TransitionAction[] = []
    const regex = /TRANSITION_TO_GOALS:\s*([^\n]+)/gi
    
    let match
    while ((match = regex.exec(response)) !== null) {
      actions.push({
        type: 'transition_to_goals',
        personaName: match[1].trim()
      })
    }
    
    return actions
  }
}
