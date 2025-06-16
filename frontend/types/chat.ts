export interface ChatMessage {
  id: string
  from: 'user' | 'coach' | 'system'
  text: string
  timestamp: Date
}

export interface ChatServiceResult {
  success: boolean
  coachReply?: string
  error?: string
}
