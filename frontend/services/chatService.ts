// services/chatService.ts - Enhanced with database persistence

import { ConversationManager } from './conversation/ConversationManager'
import { ChatMessage } from '@/types/chat'

export type ConversationMode = 'goals' | 'habits' | 'reflection' | 'general' | 'persona_discovery'

export interface ApiResponse {
  success: boolean
  data?: any
  error?: string
}

export interface ChatServiceConfig {
  apiEndpoint?: string
  maxMessages?: number
  enableLogging?: boolean
  backendUrl?: string
}

export interface BackendConversation {
  id: string
  persona_id?: string
  user_id: string
  discussion_type: string
  topic: string
  status: string
  messages: Array<{
    sequence: number
    timestamp: string
    from: string
    text: string
  }>
  key_insights: string[]
  conversation_summary?: string
  started_at: string
  last_activity_at: string
}

/**
 * Enhanced ChatService with database persistence
 * 
 * Key improvements:
 * 1. Persists conversations to backend database
 * 2. Loads existing conversations on initialization
 * 3. Auto-saves messages as they're sent
 * 4. Handles offline/online scenarios
 */
export class ChatService {
  private messages: ChatMessage[] = []
  private conversationManager: ConversationManager
  private apiEndpoint: string
  private maxMessages: number
  private enableLogging: boolean
  private backendUrl: string
  
  // New: Conversation persistence state
  private currentConversationId: string | null = null
  private userId: string | null = null
  private isOnline: boolean = true
  private pendingMessages: ChatMessage[] = []

  constructor(config: ChatServiceConfig = {}) {
    this.apiEndpoint = config.apiEndpoint || '/api/openai-chat'
    this.maxMessages = config.maxMessages || 100
    this.enableLogging = config.enableLogging || false
    this.backendUrl = config.backendUrl || 'http://localhost:8000'
    this.conversationManager = new ConversationManager(this.apiEndpoint)
    
    // Don't initialize with welcome message yet - load from backend first
  }

  // ==========================================
  // INITIALIZATION & SETUP
  // ==========================================

  /**
   * Initialize the chat service with a user
   * This should be called when user logs in or when starting the app
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId
    
    try {
      // Try to load the most recent persona discovery conversation
      await this.loadLatestConversation()
    } catch (error) {
      this.log('Failed to load conversation from backend, starting fresh', { error })
      this.initializeWithWelcome()
    }
  }

  /**
   * Load the most recent conversation from backend
   */
  private async loadLatestConversation(): Promise<void> {
    if (!this.userId) {
      this.initializeWithWelcome()
      return
    }

    try {
      // First, try to find the most recent persona discovery conversation
      const response = await fetch(`${this.backendUrl}/users/${this.userId}/conversations?type=persona_discovery&limit=1`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const conversations = await response.json()
      
      if (conversations && conversations.length > 0) {
        const conversation = conversations[0]
        this.currentConversationId = conversation.id
        
        // Convert backend messages to frontend format
        this.messages = conversation.messages.map((msg: any) => ({
          id: `${msg.sequence}`,
          from: msg.from === 'user' ? 'user' : 'coach',
          text: msg.text,
          timestamp: new Date(msg.timestamp)
        }))
        
        this.log('Loaded existing conversation', { 
          conversationId: this.currentConversationId, 
          messageCount: this.messages.length 
        })
      } else {
        // No existing conversation, start fresh
        await this.startNewConversation()
      }
    } catch (error) {
      this.log('Error loading conversation, starting fresh', { error })
      await this.startNewConversation()
    }
  }

  /**
   * Start a new conversation in the backend
   */
  private async startNewConversation(): Promise<void> {
    if (!this.userId) {
      this.initializeWithWelcome()
      return
    }

    try {
      const response = await fetch(`${this.backendUrl}/conversations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: this.userId,
          discussion_type: 'persona_discovery',
          topic: 'Discovering and defining user personas'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const conversation = await response.json()
      this.currentConversationId = conversation.id
      
      this.initializeWithWelcome()
      
      // Save the welcome message to backend
      await this.saveMessageToBackend(this.messages[0])
      
      this.log('Started new conversation', { conversationId: this.currentConversationId })
    } catch (error) {
      this.log('Failed to start backend conversation, using local only', { error })
      this.currentConversationId = null
      this.initializeWithWelcome()
    }
  }

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
  // ENHANCED MESSAGING WITH PERSISTENCE
  // ==========================================

  /**
   * Send a message with automatic backend persistence
   */
  async sendMessage(userMessage: string): Promise<{
    success: boolean
    coachReply?: string
    personaActions?: any[]
    error?: string
  }> {
    if (!userMessage.trim()) {
      return { success: false, error: 'Message cannot be empty' }
    }

    // Add user message to local history first (optimistic update)
    const userMsg: ChatMessage = {
      id: this.generateId(),
      from: 'user',
      text: userMessage.trim(),
      timestamp: new Date()
    }
    this.addMessage(userMsg)

    // Save user message to backend
    await this.saveMessageToBackend(userMsg)

    try {
      // Use the enhanced ConversationManager
      const result = await this.conversationManager.processMessage(userMessage)

      // Add coach response to local history
      const coachMsg: ChatMessage = {
        id: this.generateId(),
        from: 'coach',
        text: result.userResponse,
        timestamp: new Date()
      }
      this.addMessage(coachMsg)

      // Save coach message to backend
      await this.saveMessageToBackend(coachMsg)

      this.log('Message sent and saved successfully', { 
        userMessage, 
        coachReply: result.userResponse,
        personaActionsCount: result.personaActions?.length || 0
      })
      
      return { 
        success: true, 
        coachReply: result.userResponse,
        personaActions: result.personaActions // ✅ This will now include refinement actions
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

      // Try to save error to backend too
      await this.saveMessageToBackend(errorMsg)

      this.log('Message failed', { error: error.message })

      return { 
        success: false, 
        error: error.message || 'Unknown error' 
      }
    }
  }

  /**
   * Save a message to the backend database
   */
  private async saveMessageToBackend(message: ChatMessage): Promise<void> {
    if (!this.currentConversationId || !this.isOnline) {
      // Queue for later if offline
      this.pendingMessages.push(message)
      return
    }

    try {
      const response = await fetch(`${this.backendUrl}/conversations/${this.currentConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_role: message.from,
          text: message.text
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      this.log('Message saved to backend', { messageId: message.id })
    } catch (error) {
      this.log('Failed to save message to backend', { error, messageId: message.id })
      this.pendingMessages.push(message)
      this.isOnline = false
      
      // Try to reconnect after a delay
      setTimeout(() => this.retryPendingMessages(), 5000)
    }
  }

  /**
   * Retry saving pending messages when back online
   */
  private async retryPendingMessages(): Promise<void> {
    if (this.pendingMessages.length === 0) {
      this.isOnline = true
      return
    }

    try {
      // Test connectivity
      const testResponse = await fetch(`${this.backendUrl}/health`)
      if (!testResponse.ok) throw new Error('Backend not available')

      this.isOnline = true
      
      // Save all pending messages
      const messagesToSave = [...this.pendingMessages]
      this.pendingMessages = []

      for (const message of messagesToSave) {
        await this.saveMessageToBackend(message)
      }

      this.log('Successfully saved pending messages', { count: messagesToSave.length })
    } catch (error) {
      this.log('Still offline, will retry later', { error })
      // Try again in 10 seconds
      setTimeout(() => this.retryPendingMessages(), 10000)
    }
  }

  /**
   * Get response from the AI coach (legacy method - now using ConversationManager)
   */
  private async getCoachResponse(userMessage: string): Promise<string> {
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
  // CONVERSATION MANAGEMENT (Enhanced)
  // ==========================================

  /**
   * Complete the current conversation with insights
   */
  async completeCurrentConversation(insights: string[], summary?: string): Promise<void> {
    if (!this.currentConversationId) return

    try {
      const response = await fetch(`${this.backendUrl}/conversations/${this.currentConversationId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_insights: insights,
          summary
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      this.log('Conversation completed', { conversationId: this.currentConversationId })
    } catch (error) {
      this.log('Failed to complete conversation', { error })
    }
  }

  /**
   * Get conversation history for a specific persona
   */
  async getPersonaConversations(personaId: string): Promise<BackendConversation[]> {
    try {
      const response = await fetch(`${this.backendUrl}/personas/${personaId}/conversations`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      this.log('Failed to load persona conversations', { error })
      return []
    }
  }

  // ==========================================
  // MESSAGE MANAGEMENT (Enhanced)
  // ==========================================

  private addMessage(message: ChatMessage): void {
    this.messages.push(message)
    
    if (this.messages.length > this.maxMessages) {
      const systemMessages = this.messages.filter(m => m.from === 'system')
      const recentMessages = this.messages
        .filter(m => m.from !== 'system')
        .slice(-this.maxMessages + systemMessages.length)
      
      this.messages = [...systemMessages, ...recentMessages]
    }
  }

  getMessages(): ChatMessage[] {
    return this.messages.filter(m => m.from !== 'system')
  }

  /**
   * Clear messages and start a new conversation
   */
  async clearMessages(): Promise<void> {
    // Complete current conversation if exists
    if (this.currentConversationId) {
      await this.completeCurrentConversation(['User requested new conversation'])
    }

    // Start fresh
    if (this.userId) {
      await this.startNewConversation()
    } else {
      this.initializeWithWelcome()
    }
    
    this.log('Messages cleared and new conversation started')
  }

  // ==========================================
  // STATUS AND MONITORING
  // ==========================================

  /**
   * Get sync status for UI display
   */
  getSyncStatus(): {
    isOnline: boolean
    conversationId: string | null
    pendingMessages: number
    lastSyncTime: Date | null
  } {
    return {
      isOnline: this.isOnline,
      conversationId: this.currentConversationId,
      pendingMessages: this.pendingMessages.length,
      lastSyncTime: this.messages.length > 0 ? this.messages[this.messages.length - 1].timestamp : null
    }
  }

  // ==========================================
  // PERSONA PARSING (Legacy - now handled by agents)
  // ==========================================

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

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private log(message: string, data?: any): void {
    if (this.enableLogging) {
      console.log(`[ChatService] ${message}`, data || '')
    }
  }

  updateConfig(config: Partial<ChatServiceConfig>): void {
    if (config.apiEndpoint) this.apiEndpoint = config.apiEndpoint
    if (config.maxMessages) this.maxMessages = config.maxMessages
    if (config.enableLogging !== undefined) this.enableLogging = config.enableLogging
    if (config.backendUrl) this.backendUrl = config.backendUrl
  }

  getConfig(): ChatServiceConfig {
    return {
      apiEndpoint: this.apiEndpoint,
      maxMessages: this.maxMessages,
      enableLogging: this.enableLogging,
      backendUrl: this.backendUrl
    }
  }
}
