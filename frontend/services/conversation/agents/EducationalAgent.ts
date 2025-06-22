// services/conversation/agents/EducationalAgent.ts
import { BaseAgent } from './BaseAgent'
import { ConversationContext, AgentResult, AgentType } from '../ConversationContext'

export class EducationalAgent extends BaseAgent {
  readonly type = AgentType.EDUCATIONAL

  canHandle(userMessage: string, context: ConversationContext): boolean {
    const msg = userMessage.toLowerCase()
    return msg.includes('what') || msg.includes('explain') || msg.includes('examples')
  }

  generateSystemPrompt(context: ConversationContext): string {
    return `You are a life coach explaining persona and northstar concepts to someone new.

Key points to cover:
- A persona represents different roles/identities we embody (Parent, Professional, Creative, etc.)
- A northstar (arête) is the guiding principle that defines excellence for each persona
- Give 2-3 concrete examples of famous people's personas and their northstars

IMPORTANT:
- DO NOT ask about their specific personas yet
- DO NOT suggest personas for this user
- Keep it educational and inspiring
- End by asking if they want to learn more or start discovering their own

Be conversational and encouraging.`
  }

  processResponse(aiResponse: string, context: ConversationContext): AgentResult {
    // Educational agent doesn't create persona actions
    return {
      userResponse: aiResponse,
      personaActions: [],
      contextUpdates: {
        temporaryState: {
          ...context.temporaryState,
          educationalTopics: ['persona-concept', 'northstar-concept', 'examples']
        }
      }
    }
  }
}
