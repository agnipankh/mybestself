// services/apiClient.ts
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
  // CONVERSATION OPERATIONS
  // ============================================

  async createConversation(data: {
    persona_id: string
    discussion_type: string
    topic: string
  }): Promise<any> {
    return this.request('/conversations/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async addMessageToConversation(conversationId: string, message: {
    from_role: string
    text: string
  }): Promise<any> {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    })
  }

  async completeConversation(conversationId: string, completion: {
    key_insights: string[]
    summary?: string
  }): Promise<any> {
    return this.request(`/conversations/${conversationId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(completion),
    })
  }

  async getPersonaConversations(personaId: string): Promise<any[]> {
    return this.request(`/personas/${personaId}/conversations`)
  }
}

export const apiClient = new ApiClient()
