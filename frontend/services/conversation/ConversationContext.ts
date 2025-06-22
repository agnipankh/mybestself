// services/conversation/ConversationContext.ts
import { ChatMessage } from '@/types/chat'

export interface ConversationContext {
  currentAgentType: AgentType
  targetPersonaId?: string
  temporaryState: {
    draftPersonas?: Array<{name: string, northStar: string, confidence: number}>
    workingDefinitions?: string[]
    educationalTopics?: string[]
  }
  conversationHistory: ChatMessage[]
  lastIntentConfidence: number
}

export enum AgentType {
  EDUCATIONAL = 'educational',
  DISCOVERY = 'discovery', 
  REFINEMENT = 'refinement',
  MANAGEMENT = 'management'
}

export interface AgentResult {
  userResponse: string
  personaActions: PersonaAction[]
  contextUpdates: Partial<ConversationContext>
}

export interface PersonaAction {
  type: 'create' | 'update' | 'delete'
  id?: string
  name: string
  northStar?: string
  previousName?: string
}
