// services/apiClient.ts - Updated with new conversation endpoints
export interface BackendPersona {
  id: string
  user_id: string
  label: string
  north_star: string
  is_calling: boolean
  created_at: string
  updated_at: string
}

export interface BackendUser {
  id: string
  name: string
  email: string
  created_at: string
}

export interface BackendConversation {
  id: string
  user_id: string
  conversation_type: string  // Updated from discussion_type
  topic: string
  status: string
  tags: string[]  // New: replaces persona_id
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

export interface CreatePersonaRequest {
  user_id: string
  label: string
  north_star: string
  is_calling?: boolean
}

export interface CreateUserRequest {
  name: string
  email: string
}

export interface CreateConversationRequest {
  user_id: string
  conversation_type: string  // 'discovery', 'refinement', 'decision_making'
  topic: string
  tags?: string[]
}

export interface AddMessageRequest {
  from_role: string  // 'user' or 'coach'
  text: string
}

export interface CompleteConversationRequest {
  key_insights: string[]
  summary?: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl
  }

  /**
   * Generic request method with better error handling
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    console.log(`[ApiClient] ${options.method || 'GET'} ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        detail: `HTTP ${response.status}: ${response.statusText}` 
      }))
      console.error(`[ApiClient] Error ${response.status}:`, error)
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  async createUser(userData: CreateUserRequest): Promise<BackendUser> {
    return this.request<BackendUser>('/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async getUser(userId: string): Promise<BackendUser> {
    return this.request<BackendUser>(`/users/${userId}`)
  }

  // ============================================
  // PERSONA OPERATIONS - RESTful Design
  // ============================================

  /**
   * Create a new persona
   */
  async createPersona(personaData: CreatePersonaRequest): Promise<BackendPersona> {
    return this.request<BackendPersona>('/personas/', {
      method: 'POST',
      body: JSON.stringify(personaData),
    })
  }

  /**
   * Get all personas for a user
   */
  async getPersonas(userId: string): Promise<BackendPersona[]> {
    return this.request<BackendPersona[]>(`/users/${userId}/personas`)
  }

  /**
   * Get a specific persona by ID
   */
  async getPersona(personaId: string): Promise<BackendPersona> {
    return this.request<BackendPersona>(`/personas/${personaId}`)
  }

  /**
   * Update a persona by ID
   */
  async updatePersona(personaId: string, updates: Partial<CreatePersonaRequest>): Promise<BackendPersona> {
    return this.request<BackendPersona>(`/personas/${personaId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Delete a persona by ID (preferred method)
   */
  async deletePersonaById(personaId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/personas/${personaId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Delete a persona by user ID and label (legacy method for backward compatibility)
   */
  async deletePersona(userId: string, label: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${userId}/personas/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // CONVERSATION OPERATIONS - NEW USER-CENTRIC API
  // ============================================

  /**
   * Create a new conversation
   */
  async createConversation(data: CreateConversationRequest): Promise<BackendConversation> {
    return this.request<BackendConversation>('/conversations/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Add a message to a conversation
   */
  async addMessageToConversation(conversationId: string, message: AddMessageRequest): Promise<any> {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    })
  }

  /**
   * Complete a conversation with insights
   */
  async completeConversation(conversationId: string, completion: CompleteConversationRequest): Promise<any> {
    return this.request(`/conversations/${conversationId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(completion),
    })
  }

  /**
   * Get all conversations for a user with optional filtering
   */
  async getUserConversations(
    userId: string,
    options: {
      conversation_type?: string
      tag?: string
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ conversations: BackendConversation[], total_count: number }> {
    const params = new URLSearchParams()
    
    if (options.conversation_type) params.append('conversation_type', options.conversation_type)
    if (options.tag) params.append('tag', options.tag)
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())
    
    const queryString = params.toString()
    const url = queryString ? `/users/${userId}/conversations?${queryString}` : `/users/${userId}/conversations`
    
    return this.request<{ conversations: BackendConversation[], total_count: number }>(url)
  }

  /**
   * Get discovery conversations for a user (shorthand)
   */
  async getDiscoveryConversations(userId: string, limit?: number): Promise<{ conversations: BackendConversation[] }> {
    const params = limit ? `?limit=${limit}` : ''
    return this.request<{ conversations: BackendConversation[] }>(`/users/${userId}/conversations/discovery${params}`)
  }

  /**
   * Get conversations that discuss a specific persona
   */
  async getConversationsByPersona(userId: string, personaName: string, limit?: number): Promise<{ conversations: BackendConversation[] }> {
    const params = limit ? `?limit=${limit}` : ''
    return this.request<{ conversations: BackendConversation[] }>(`/users/${userId}/conversations/by-persona/${encodeURIComponent(personaName)}${params}`)
  }

  /**
   * Search conversations by content
   */
  async searchConversations(
    userId: string,
    query: string,
    conversationType?: string,
    limit?: number
  ): Promise<{ conversations: BackendConversation[], search_query: string, total_results: number }> {
    const params = new URLSearchParams({ q: query })
    if (conversationType) params.append('conversation_type', conversationType)
    if (limit) params.append('limit', limit.toString())
    
    return this.request<{ conversations: BackendConversation[], search_query: string, total_results: number }>(
      `/users/${userId}/conversations/search?${params.toString()}`
    )
  }

  /**
   * Add tags to a conversation (you'll need to implement this endpoint in backend)
   */
  async addTagsToConversation(conversationId: string, tags: string[]): Promise<BackendConversation> {
    return this.request<BackendConversation>(`/conversations/${conversationId}/tags`, {
      method: 'PATCH',
      body: JSON.stringify({ add_tags: tags }),
    })
  }

  /**
   * Update conversation tags (replace all tags)
   */
  async updateConversationTags(conversationId: string, tags: string[]): Promise<BackendConversation> {
    return this.request<BackendConversation>(`/conversations/${conversationId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    })
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversation(conversationId: string): Promise<BackendConversation> {
    return this.request<BackendConversation>(`/conversations/${conversationId}`)
  }

  // ============================================
  // LEGACY PERSONA CONVERSATION METHODS (for backward compatibility)
  // ============================================

  /**
   * @deprecated Use getUserConversations with tag filter instead
   */
  async getPersonaConversations(personaId: string): Promise<BackendConversation[]> {
    console.warn('getPersonaConversations is deprecated. Use getUserConversations with tag filter instead.')
    // This might not work with the new backend structure
    // You could implement this to search for conversations with the persona name as a tag
    throw new Error('getPersonaConversations is deprecated. Use getUserConversations with tag filter instead.')
  }
}

export const apiClient = new ApiClient()
