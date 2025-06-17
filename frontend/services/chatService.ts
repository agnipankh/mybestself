import { ChatMessage } from '@/types/chat'

export class ChatService {
  private messages: ChatMessage[] = []
  private apiEndpoint: string
  
  constructor(apiEndpoint: string = '/api/openai-chat') {
    this.apiEndpoint = apiEndpoint
    this.initializeWithWelcome()
  }

  private initializeWithWelcome(): void {
    this.messages = [{
      id: this.generateId(),
      from: 'coach',
      text: 'Every human being plays multiple roles — a parent, a professional, a friend. What are your major personas?',
      timestamp: new Date()
    }]
  }

  getSystemPrompt(): ChatMessage {
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

  async sendMessage(userMessage: string): Promise<{
    success: boolean
    coachReply?: string
    error?: string
  }> {
    if (!userMessage.trim()) {
      return { success: false, error: 'Message cannot be empty' }
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: this.generateId(),
      from: 'user',
      text: userMessage.trim(),
      timestamp: new Date()
    }
    this.messages.push(userMsg)

    try {
      // Prepare messages for API
      const apiMessages = [
        this.getSystemPrompt(),
        ...this.messages.filter(m => m.from !== 'system')
      ]

      // 🎯 ADD THIS DEBUG LOG
      console.log('🤖 FULL PROMPT BEING SENT TO CHATGPT:')
      console.log('=====================================')
      apiMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.from?.toUpperCase() || 'SYSTEM'}:`)
        console.log(msg.text)
        console.log('-------------------------------------')
      })
      console.log('=====================================')

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.reply) {
        throw new Error('No reply received from API')
      }

      // Add coach response
      const coachMsg: ChatMessage = {
        id: this.generateId(),
        from: 'coach',
        text: data.reply,
        timestamp: new Date()
      }
      this.messages.push(coachMsg)

      return { 
        success: true, 
        coachReply: data.reply 
      }

    } catch (error: any) {
      // Add error message to chat
      const errorMsg: ChatMessage = {
        id: this.generateId(),
        from: 'coach',
        text: `Sorry, something went wrong: ${error.message || 'Unknown error'}`,
        timestamp: new Date()
      }
      this.messages.push(errorMsg)

      return { 
        success: false, 
        error: error.message || 'Unknown error' 
      }
    }
  }

  getMessages(): ChatMessage[] {
    return this.messages.filter(m => m.from !== 'system')
  }

  clearMessages(): void {
    this.initializeWithWelcome()
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
