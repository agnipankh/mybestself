// services/conversation/ConversationContext.ts
import { ChatMessage } from '@/types/chat'
import { Persona } from '@/types/persona'

export interface ConversationContext {
  currentAgentType: AgentType
  targetPersonaId?: string
  targetPersona?: Persona
  temporaryState: {
    draftPersonas?: Array<{name: string, northStar: string, confidence: number}>
    workingDefinitions?: string[]
    educationalTopics?: string[]
    goalSettingActive?: boolean
  }
  conversationHistory: ChatMessage[]
  lastIntentConfidence: number
}

export enum AgentType {
  EDUCATIONAL = 'educational',
  DISCOVERY = 'discovery', 
  REFINEMENT = 'refinement',
  MANAGEMENT = 'management',
  GOAL = 'goal'
}

export interface AgentResult {
  userResponse: string
  personaActions: PersonaAction[]
  goalActions?: GoalAction[]
  transitionActions?: TransitionAction[]
  contextUpdates: Partial<ConversationContext>
}

export interface PersonaAction {
  type: 'create' | 'update' | 'delete'
  id?: string
  name: string
  northStar?: string
  previousName?: string
}

export interface GoalAction {
  type: 'create' | 'update' | 'delete'
  name: string
  acceptanceCriteria?: string
  reviewDate?: string
  id?: string
  originalName?: string // For updates, the original goal name to find and update
}

export interface TransitionAction {
  type: 'transition_to_goals'
  personaName: string
}
