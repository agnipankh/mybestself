// services/chatService.ts - Updated for user-centric conversations

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
  user_id: string
  conversation_type: string  // Updated from discussion_type
  topic: string
  status: string
  tags: string[]  // New: array of tags instead of persona_id
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
  ended_at?: string
}

/**
 * Enhanced ChatService with user-centric conversation persistence
 * 
 * Key improvements:
 * 1. Conversations belong to users, not personas
 * 2. Uses tags instead of persona_id for flexible conversation categorization
 * 3. Supports multiple personas per conversation via tags
 * 4. Better discovery conversation handling
 */
export class ChatService {
  private messages: ChatMessage[] = []
  private conversationManager: ConversationManager
  private apiEndpoint: string
  private maxMessages: number
  private enableLogging: boolean
  private backendUrl: string
  
  // Conversation persistence state
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
  }

  // ==========================================
  // INITIALIZATION & SETUP
  // ==========================================

  /**
   * Initialize the chat service with a user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId
    
    try {
      await this.loadLatestDiscoveryConversation()
    } catch (error) {
      this.log('Failed to load conversation from backend, starting fresh', { error })
      this.initializeWithWelcome()
    }
  }

  /**
   * Load the most recent discovery conversation from backend
   */
  private async loadLatestDiscoveryConversation(): Promise<void> {
    if (!this.userId) {
      this.initializeWithWelcome()
      return
    }

    try {
      // Use the new discovery conversations endpoint
      const response = await fetch(
        `${this.backendUrl}/users/${this.userId}/conversations/discovery?limit=1`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const conversations = data.conversations || data // Handle both formats
      
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
        
        this.log('Loaded existing discovery conversation', { 
          conversationId: this.currentConversationId, 
          messageCount: this.messages.length,
          tags: conversation.tags
        })
      } else {
        // No existing discovery conversation, start fresh
        await this.startNewDiscoveryConversation()
      }
    } catch (error) {
      this.log('Error loading conversation, starting fresh', { error })
      await this.startNewDiscoveryConversation()
    }
  }

  /**
   * Start a new discovery conversation in the backend
   */
  private async startNewDiscoveryConversation(): Promise<void> {
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
          conversation_type: 'discovery',  // Updated from 'persona_discovery'
          topic: 'Discovering and defining user personas',
          tags: ['persona-discovery']  // Use tags instead of persona_id
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
      
      this.log('Started new discovery conversation', { 
        conversationId: this.currentConversationId,
        tags: ['persona-discovery']
      })
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

  // ==========================================
  // CONVERSATION MANAGEMENT (Updated)
  // ==========================================

  /**
   * Start a new conversation with specific type and tags
   */
  async startNewConversation(
    type: 'discovery' | 'refinement' | 'decision_making' | 'goals' = 'discovery',
    topic: string = 'General conversation',
    tags: string[] = []
  ): Promise<void> {
    if (!this.userId) {
      this.initializeWithWelcome()
      return
    }

    // Complete current conversation if exists
    if (this.currentConversationId) {
      await this.completeCurrentConversation(['User started new conversation'])
    }

    try {
      const response = await fetch(`${this.backendUrl}/conversations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: this.userId,
          conversation_type: type,
          topic,
          tags
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const conversation = await response.json()
      this.currentConversationId = conversation.id
      
      this.initializeWithWelcome()
      await this.saveMessageToBackend(this.messages[0])
      
      this.log('Started new conversation', { 
        conversationId: this.currentConversationId,
        type,
        tags
      })
    } catch (error) {
      this.log('Failed to start backend conversation, using local only', { error })
      this.currentConversationId = null
      this.initializeWithWelcome()
    }
  }

  /**
   * Add tags to current conversation (useful when personas are mentioned)
   */
  async addTagsToCurrentConversation(newTags: string[]): Promise<void> {
    if (!this.currentConversationId || newTags.length === 0) return

    try {
      // You'll need to add this endpoint to your backend
      const response = await fetch(`${this.backendUrl}/conversations/${this.currentConversationId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ add_tags: newTags })
      })

      if (response.ok) {
        this.log('Added tags to conversation', { tags: newTags })
      }
    } catch (error) {
      this.log('Failed to add tags to conversation', { error, tags: newTags })
    }
  }

  /**
   * Get conversations by type or tags
   */
  async getConversations(
    type?: 'discovery' | 'refinement' | 'decision_making',
    tag?: string,
    limit?: number
  ): Promise<BackendConversation[]> {
    if (!this.userId) return []

    try {
      let url = `${this.backendUrl}/users/${this.userId}/conversations?`
      const params = new URLSearchParams()
      
      if (type) params.append('conversation_type', type)
      if (tag) params.append('tag', tag)
      if (limit) params.append('limit', limit.toString())
      
      const response = await fetch(`${url}${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return data.conversations || data
    } catch (error) {
      this.log('Failed to load conversations', { error })
      return []
    }
  }

  /**
   * Get conversations that discuss a specific persona
   */
  async getPersonaConversations(personaName: string): Promise<BackendConversation[]> {
    return this.getConversations(undefined, personaName)
  }

  /**
   * Search conversations by content
   */
  async searchConversations(
    query: string,
    type?: 'discovery' | 'refinement' | 'decision_making'
  ): Promise<BackendConversation[]> {
    if (!this.userId) return []

    try {
      let url = `${this.backendUrl}/users/${this.userId}/conversations/search?q=${encodeURIComponent(query)}`
      if (type) url += `&conversation_type=${type}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return data.conversations || []
    } catch (error) {
      this.log('Failed to search conversations', { error })
      return []
    }
  }

  // ==========================================
  // ENHANCED MESSAGING (Updated)
  // ==========================================

  /**
   * Send a message with automatic backend persistence and persona tagging
   */
  async sendMessage(userMessage: string): Promise<{
    success: boolean
    coachReply?: string
    personaActions?: any[]
    goalActions?: any[]
    transitionActions?: any[]
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

      // If personas were mentioned, add them as tags to the conversation
      if (result.personaActions && result.personaActions.length > 0) {
        const personaTags = result.personaActions.map(action => action.name)
        await this.addTagsToCurrentConversation(personaTags)
      }

      this.log('Message sent and saved successfully', { 
        userMessage, 
        coachReply: result.userResponse,
        personaActionsCount: result.personaActions?.length || 0
      })
      
      return { 
        success: true, 
        coachReply: result.userResponse,
        personaActions: result.personaActions,
        goalActions: result.goalActions,
        transitionActions: result.transitionActions
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
      // Test connectivity with new health endpoint (you may need to add this)
      const testResponse = await fetch(`${this.backendUrl}/users/${this.userId}/conversations?limit=1`)
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

  // ==========================================
  // CONVERSATION COMPLETION (Updated)
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
   * Clear messages and start a new discovery conversation
   */
  async clearMessages(): Promise<void> {
    // Complete current conversation if exists
    if (this.currentConversationId) {
      await this.completeCurrentConversation(['User requested new conversation'])
    }

    // Start fresh discovery conversation
    if (this.userId) {
      await this.startNewDiscoveryConversation()
    } else {
      this.initializeWithWelcome()
    }
    
    this.log('Messages cleared and new conversation started')
  }

  // ==========================================
  // MESSAGE MANAGEMENT & UTILITIES (Unchanged)
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

  /**
   * Set up goal-setting context with persona information
   */
  setupGoalContext(persona: any): void {
    this.conversationManager.setTargetPersonaForGoals(persona)
    this.log('Goal context set up', { personaName: persona.name })
  }

  /**
   * Start a goal-setting conversation with empty messages
   */
  async startGoalConversation(persona: any): Promise<void> {
    if (!this.userId) {
      this.messages = [] // Start with empty messages for goals
      return
    }

    // Complete current conversation if exists
    if (this.currentConversationId) {
      await this.completeCurrentConversation(['User started goal setting'])
    }

    // Set up goal context first
    this.setupGoalContext(persona)

    try {
      const response = await fetch(`${this.backendUrl}/conversations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: this.userId,
          conversation_type: 'goals',
          topic: `Setting goals for ${persona.name} persona`,
          tags: [persona.name, 'goal-setting']
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const conversation = await response.json()
      this.currentConversationId = conversation.id

      // Start with empty messages for goal setting
      this.messages = []
      
      this.log('Started goal conversation', { 
        conversationId: this.currentConversationId,
        personaName: persona.name
      })
    } catch (error) {
      this.log('Failed to start goal conversation, using local only', { error })
      this.currentConversationId = null
      this.messages = [] // Still start with empty messages
    }
  }
}
