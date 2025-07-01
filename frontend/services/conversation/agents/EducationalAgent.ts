// services/conversation/agents/EducationalAgent.ts
import { BaseAgent } from './BaseAgent'
import { ConversationContext, AgentResult, AgentType, PersonaAction, TransitionAction } from '../ConversationContext'

export class EducationalAgent extends BaseAgent {
  readonly type = AgentType.EDUCATIONAL

  canHandle(userMessage: string, context: ConversationContext): boolean {
    const msg = userMessage.toLowerCase()
    return msg.includes('what') || msg.includes('explain') || msg.includes('examples')
  }

  generateSystemPrompt(context: ConversationContext): string {
    const conversationHistory = context.conversationHistory.map(msg => `${msg.from}: ${msg.text}`).join('\n')
    
    return `You are a life coach explaining persona and northstar concepts to someone new.

Key points to cover:
- A persona represents different roles/identities we embody (Parent, Professional, Creative, etc.)
- A northstar (arête) is the guiding principle that defines excellence for each persona
- Give 2-3 concrete examples of famous people's personas and their northstars

PERSONA CREATION LOGIC:
- If the user explicitly provides a persona and northstar (like "Persona: Loving Father, Northstar: To be always present for my kids"), acknowledge it and ask if they'd like you to add it
- If the user references something from the conversation (like "I like that one", "the first one", "that sounds good"), try to infer what persona/northstar they're referring to from the conversation context
- If the user confirms they want a persona added, respond with: PERSONA_CONFIRMED: [persona name] | [northstar]
- If you're unsure what they're referring to, ask for clarification

GOAL TRANSITION DETECTION:
If the user wants to turn a persona into daily practices, goals, or actionable steps, respond with:
TRANSITION_TO_GOALS: [persona name]

Then suggest they move to the goals page: "Great! Let me take you to the goals page for your [persona name] persona where we can create specific, measurable goals and track your progress."

CONVERSATION CONTEXT:
${conversationHistory}

Be conversational and encouraging. Use the conversation history to understand what the user might be referring to.`
  }

  processResponse(aiResponse: string, context: ConversationContext): AgentResult {
    const personaActions = this.parsePersonaActions(aiResponse)
    const transitionActions = this.parseTransitionActions(aiResponse)
    const cleanResponse = this.cleanResponseForUser(aiResponse)
    
    return {
      userResponse: cleanResponse,
      personaActions,
      transitionActions,
      contextUpdates: {
        temporaryState: {
          ...context.temporaryState,
          educationalTopics: ['persona-concept', 'northstar-concept', 'examples']
        }
      }
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
