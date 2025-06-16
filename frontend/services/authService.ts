// services/authService.ts
export interface User {
  id: string  // This will be a UUID string from your backend
  email: string
  isAuthenticated: boolean
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}

export class AuthService {
  private user: User | null = null
  private listeners: ((user: User | null) => void)[] = []
  private readonly BACKEND_URL = 'http://localhost:8000'

  constructor() {
    // Check for existing session on initialization
    this.checkExistingSession()
  }

  /**
   * Check if user has an existing session
   */
  private checkExistingSession() {
    if (typeof window === 'undefined') return

    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        this.user = JSON.parse(userData)
        this.notifyListeners()
      } catch (error) {
        console.error('Failed to parse stored user data:', error)
        localStorage.removeItem('user')
      }
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.user
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.user?.isAuthenticated ?? false
  }

  /**
   * Request magic link via email
   */
  async requestMagicLink(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/auth/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send magic link')
      }

      return { success: true, message: 'Magic link sent to your email!' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send magic link'
      }
    }
  }

  /**
   * Verify magic link token
   */
  async verifyMagicLink(token: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/auth/verify?token=${encodeURIComponent(token)}`, {
        method: 'GET',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid or expired token')
      }

      // Create user object - your backend returns UUID as string
      const user: User = {
        id: data.user_id, // This is a UUID string from your backend
        email: data.email || '', // Add email to your backend response if not already there
        isAuthenticated: true,
      }

      // Store user session
      this.user = user
      localStorage.setItem('user', JSON.stringify(user))
      this.notifyListeners()

      return { success: true, user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    this.user = null
    localStorage.removeItem('user')
    this.notifyListeners()
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.push(callback)
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback)
    }
  }

  /**
   * Notify all listeners of auth state change
   */
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.user))
  }

  /**
   * Get user ID for API calls (returns UUID string)
   */
  getUserId(): string | null {
    return this.user?.id ?? null
  }
}

// Export singleton instance
export const authService = new AuthService()
