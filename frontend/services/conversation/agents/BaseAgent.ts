// services/conversation/agents/BaseAgent.ts
import { ConversationContext, AgentResult, AgentType } from '../ConversationContext'
import { ChatMessage } from '@/types/chat'

export abstract class BaseAgent {
  abstract readonly type: AgentType
  
  abstract canHandle(userMessage: string, context: ConversationContext): boolean
  abstract generateSystemPrompt(context: ConversationContext): string
  abstract processResponse(aiResponse: string, context: ConversationContext): AgentResult
  
  protected cleanResponseForUser(aiResponse: string): string {
    // Remove any agent-specific formatting that shouldn't be shown to user
    return aiResponse
      .replace(/PERSONA_CONFIRMED:\s*[^|]+\|[^\n]+\n?/gi, '')
      .replace(/REFINED_NORTHSTAR:\s*[^\n]+\n?/gi, '')
      .replace(/VARIANT_PERSONA:\s*[^|]+\|[^\n]+\n?/gi, '')
      .trim()
  }
}
