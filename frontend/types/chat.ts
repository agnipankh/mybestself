// services/chatService.ts
import { ChatMessage } from '@/types/chat'

// Type definitions for better maintainability
export type ConversationMode = 'goals' | 'habits' | 'reflection' | 'general'

export interface ApiResponse {
  success: boolean
  data?: any
  error?: string
}

export interface ChatServiceConfig {
  apiEndpoint?: string
  maxMessages?: number
  enableLogging?: boolean
}

/**
 * ChatService handles all chat-related functionality
 * 
 * Key responsibilities:
 * 1. Manage chat messages and state
 * 2. Communicate with backend APIs
 * 3. Parse persona updates from coach responses
 * 4. Provide conversation history management
 */
export class ChatService {
  private messages: ChatMessage[] = []
  private apiEndpoint: string
  private maxMessages: number
  private enableLogging: boolean
  
  constructor(config: ChatServiceConfig = {}) {
    this.apiEndpoint = config.apiEndpoint || '/api/openai-chat'
    this.maxMessages = config.maxMessages || 100
    this.enableLogging = config.enableLogging || false
    this.initializeWithWelcome()
  }

  // ==========================================
  // INITIALIZATION & SETUP
  // ==========================================

  private initializeWithWelcome(): void {
    this.messages = [{
      id: this.generateId(),
      from: 'coach',
      text: 'Every human being plays multiple roles — a parent, a professional, a friend. What are your major personas?',
      timestamp: new Date()
    }]
  }

  private getSystemPrompt(): ChatMessage {
    return {
      id: 'system',
      from: 'system',
      text: `You are a life coach helping a user define their major personas and associated guiding principles (North Stars).
      
Each time the user describes something about their identity, suggest one or more personas in the following format:

Persona: [Name] (was: [PreviousName])
North Star: [Goal]

Use the (was: ...) clause only when renaming or refining an existing persona.

You may return multiple personas in one message. Use only this exact format with no extra commentary.`,
      timestamp: new Date()
    }
  }

  // ==========================================
  // CORE MESSAGING FUNCTIONALITY
  // ==========================================

  /**
   * Send a message to the coach and get a response
   * This is the main entry point for chat interactions
   */
  async sendMessage(userMessage: string): Promise<{
    success: boolean
    coachReply?: string
    error?: string
  }> {
    if (!userMessage.trim()) {
      return { success: false, error: 'Message cannot be empty' }
    }

    // Add user message to history
    const userMsg: ChatMessage = {
      id: this.generateId(),
      from: 'user',
      text: userMessage.trim(),
      timestamp: new Date()
    }
    this.addMessage(userMsg)

    try {
      const coachReply = await this.getCoachResponse(userMessage)
      
      // Add coach response to history
      const coachMsg: ChatMessage = {
        id: this.generateId(),
        from: 'coach',
        text: coachReply,
        timestamp: new Date()
      }
      this.addMessage(coachMsg)

      this.log('Message sent successfully', { userMessage, coachReply })
      
      return { 
        success: true, 
        coachReply 
      }

    } catch (error: any) {
      const errorMessage = `Sorry, something went wrong: ${error.message || 'Unknown error'}`
      
      // Add error message to chat for user visibility
      const errorMsg: ChatMessage = {
        id: this.generateId(),
        from: 'coach',
        text: errorMessage,
        timestamp: new Date()
      }
      this.addMessage(errorMsg)

      this.log('Message failed', { error: error.message })

      return { 
        success: false, 
        error: error.message || 'Unknown error' 
      }
    }
  }

  /**
   * Get response from the AI coach
   * Separated for easier testing and maintenance
   */
  private async getCoachResponse(userMessage: string): Promise<string> {
    // Prepare messages for API (include system prompt)
    const apiMessages = [
      this.getSystemPrompt(),
      ...this.messages.filter(m => m.from !== 'system')
    ]

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.reply) {
      throw new Error('No reply received from API')
    }

    return data.reply
  }

  // ==========================================
  // CONVERSATION MANAGEMENT
  // ==========================================

  /**
   * Start a new conversation with a specific persona
   * This method can be extended for different conversation types
   */
  async startNewConversation(personaId: string, discussionType: ConversationMode): Promise<string> {
    try {
      this.log('Starting new conversation', { personaId, discussionType })
      
      // You can implement this to call a backend API that creates
      // a new conversation context for the specific persona
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personaId, 
          discussionType,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.status}`)
      }

      const data = await response.json()
      return data.conversationId

    } catch (error: any) {
      this.log('Failed to start conversation', { error: error.message })
      throw error
    }
  }

  /**
   * Continue an existing conversation
   */
  async continueConversation(conversationId: string, message: string): Promise<string> {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      if (!response.ok) {
        throw new Error(`Failed to continue conversation: ${response.status}`)
      }

      const data = await response.json()
      return data.reply

    } catch (error: any) {
      this.log('Failed to continue conversation', { error: error.message })
      throw error
    }
  }

  // ==========================================
  // MESSAGE MANAGEMENT
  // ==========================================

  /**
   * Add a message to the conversation history
   * Includes automatic cleanup for memory management
   */
  private addMessage(message: ChatMessage): void {
    this.messages.push(message)
    
    // Keep only the most recent messages to prevent memory issues
    if (this.messages.length > this.maxMessages) {
      // Keep system messages and recent messages
      const systemMessages = this.messages.filter(m => m.from === 'system')
      const recentMessages = this.messages
        .filter(m => m.from !== 'system')
        .slice(-this.maxMessages + systemMessages.length)
      
      this.messages = [...systemMessages, ...recentMessages]
    }
  }

  /**
   * Get all messages except system messages
   * This is what the UI should display
   */
  getMessages(): ChatMessage[] {
    return this.messages.filter(m => m.from !== 'system')
  }

  /**
   * Get conversation summary for persistence
   */
  getConversationSummary(): {
    messageCount: number
    lastMessage?: ChatMessage
    duration: number
  } {
    const userMessages = this.messages.filter(m => m.from !== 'system')
    const firstMessage = userMessages[0]
    const lastMessage = userMessages[userMessages.length - 1]
    
    const duration = firstMessage && lastMessage 
      ? lastMessage.timestamp.getTime() - firstMessage.timestamp.getTime()
      : 0

    return {
      messageCount: userMessages.length,
      lastMessage,
      duration
    }
  }

  /**
   * Clear all messages and restart
   */
  clearMessages(): void {
    this.initializeWithWelcome()
    this.log('Messages cleared')
  }

  // ==========================================
  // PERSONA PARSING (for integration with PersonaService)
  // ==========================================

  /**
   * Parse persona updates from coach responses
   * This method is used by PersonaService to extract structured data
   */
  parsePersonaUpdates(coachReply: string): Array<{
    action: 'create' | 'update'
    name: string
    previousName?: string
    northStar: string
  }> {
    const updates: Array<{
      action: 'create' | 'update'
      name: string
      previousName?: string
      northStar: string
    }> = []

    // Parse format: "Persona: [Name] (was: [PreviousName])\nNorth Star: [Goal]"
    const personaRegex = /Persona:\s*([^\n(]+)(?:\s*\(was:\s*([^)]+)\))?\s*\n?North Star:\s*([^\n]+)/gi

    let match
    while ((match = personaRegex.exec(coachReply)) !== null) {
      const name = match[1].trim()
      const previousName = match[2]?.trim()
      const northStar = match[3].trim()

      if (name && northStar) {
        updates.push({
          action: previousName ? 'update' : 'create',
          name,
          previousName,
          northStar
        })
      }
    }

    this.log('Parsed persona updates', { updates })
    return updates
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Generate unique IDs for messages
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Logging utility for debugging
   */
  private log(message: string, data?: any): void {
    if (this.enableLogging) {
      console.log(`[ChatService] ${message}`, data || '')
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChatServiceConfig>): void {
    if (config.apiEndpoint) this.apiEndpoint = config.apiEndpoint
    if (config.maxMessages) this.maxMessages = config.maxMessages
    if (config.enableLogging !== undefined) this.enableLogging = config.enableLogging
  }

  /**
   * Get current configuration
   */
  getConfig(): ChatServiceConfig {
    return {
      apiEndpoint: this.apiEndpoint,
      maxMessages: this.maxMessages,
      enableLogging: this.enableLogging
    }
  }
}
