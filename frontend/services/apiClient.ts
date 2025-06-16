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

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // User operations
  async createUser(userData: CreateUserRequest): Promise<BackendUser> {
    return this.request<BackendUser>('/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  // Persona operations
  async createPersona(personaData: CreatePersonaRequest): Promise<BackendPersona> {
    return this.request<BackendPersona>('/personas/', {
      method: 'POST',
      body: JSON.stringify(personaData),
    })
  }

  async getPersonas(userId: string): Promise<BackendPersona[]> {
    return this.request<BackendPersona[]>(`/users/${userId}/personas`)
  }

  async deletePersona(userId: string, label: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/personas/?user_id=${userId}&label=${encodeURIComponent(label)}`, {
      method: 'DELETE',
    })
  }

  // Note: Your backend doesn't have update endpoint yet, you'll need to add one
  async updatePersona(personaId: string, updates: Partial<CreatePersonaRequest>): Promise<BackendPersona> {
    return this.request<BackendPersona>(`/personas/${personaId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }
}

export const apiClient = new ApiClient()
