// services/personaService.ts
import { Persona, PersonaUpdate } from '../types/persona'

export interface PersonaServiceResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export class PersonaService {
  private personas: Persona[] = []
  private maxPersonas: number
  private userId: string | null = null

  constructor(maxPersonas: number = 9) {
    this.maxPersonas = maxPersonas
    this.userId = this.getUserId()
  }

  /**
   * Get user ID from localStorage or create a demo one
   * Returns null during SSR, will be set properly after hydration
   */
  private getUserId(): string | null {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') {
      return null
    }

    let userId = localStorage.getItem('userId')
    if (!userId) {
      userId = 'demo-user-123'
      localStorage.setItem('userId', userId)
    }
    return userId
  }

  /**
   * Initialize service by loading personas from localStorage
   * Handles SSR by returning empty array during server-side rendering
   */
  async initialize(): Promise<PersonaServiceResult<Persona[]>> {
    // During SSR, just return empty array
    if (typeof window === 'undefined') {
      return { success: true, data: [] }
    }

    // Set userId now that we're in the browser
    if (!this.userId) {
      this.userId = this.getUserId()
    }

    if (!this.userId) {
      return { success: false, error: 'No user ID available' }
    }

    try {
      const stored = localStorage.getItem(`personas_${this.userId}`)
      if (stored) {
        const parsedPersonas = JSON.parse(stored)
        this.personas = parsedPersonas.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }))
      }
      return { success: true, data: this.personas }
    } catch (error) {
      console.error('Failed to load personas:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get current personas
   */
  getPersonas(): Persona[] {
    return [...this.personas]
  }

  /**
   * Create a new persona
   */
  async createPersona(name: string, northStar: string): Promise<PersonaServiceResult<Persona>> {
    if (this.personas.length >= this.maxPersonas) {
      return { success: false, error: `Maximum ${this.maxPersonas} personas allowed` }
    }

    // Ensure we have a userId (might be null during SSR)
    if (!this.userId && typeof window !== 'undefined') {
      this.userId = this.getUserId()
    }

    const newPersona: Persona = {
      id: `persona-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      northStar,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.personas.push(newPersona)
    this.saveToLocalStorage()
    return { success: true, data: newPersona }
  }

  /**
   * Update an existing persona
   */
  async updatePersona(id: string, updates: Partial<PersonaUpdate>): Promise<PersonaServiceResult<Persona>> {
    const index = this.personas.findIndex(p => p.id === id)
    if (index === -1) {
      return { success: false, error: 'Persona not found' }
    }

    const updatedPersona = {
      ...this.personas[index],
      ...updates,
      updatedAt: new Date(),
    }

    this.personas[index] = updatedPersona
    this.saveToLocalStorage()
    return { success: true, data: updatedPersona }
  }

  /**
   * Remove a persona
   */
  async removePersona(id: string): Promise<PersonaServiceResult> {
    const index = this.personas.findIndex(p => p.id === id)
    if (index === -1) {
      return { success: false, error: 'Persona not found' }
    }

    this.personas.splice(index, 1)
    this.saveToLocalStorage()
    return { success: true }
  }

  /**
   * Parse persona updates from coach response
   */
  parsePersonaUpdates(coachReply: string): Array<{ name: string; northStar: string; previousName?: string }> {
    const updates: Array<{ name: string; northStar: string; previousName?: string }> = []
    
    console.log('Parsing coach reply:', coachReply)
    
    // More flexible regex that handles variations in formatting
    const matches = [...coachReply.matchAll(/Persona:\s*(.*?)\s*(?:\(was:\s*(.*?)\s*\))?\s*\n\s*North Star:\s*(.*?)(?:\n|$)/gi)]
    
    console.log('Regex matches found:', matches.length)

    for (const [fullMatch, newName, oldName, northStar] of matches) {
      const update = {
        name: newName.trim(),
        northStar: northStar.trim(),
        previousName: oldName?.trim(),
      }
      
      console.log('Parsed update:', update)
      updates.push(update)
    }

    return updates
  }

  /**
   * Apply parsed updates from coach
   */
  async applyUpdates(updates: Array<{ name: string; northStar: string; previousName?: string }>): Promise<Persona[]> {
    console.log('Applying updates:', updates)
    console.log('Current personas:', this.personas.map(p => ({ id: p.id, name: p.name })))

    for (const update of updates) {
      let existingPersona: Persona | undefined

      // If there's a previousName, look for a persona with that name to update
      if (update.previousName) {
        existingPersona = this.personas.find(p => 
          p.name.trim().toLowerCase() === update.previousName!.trim().toLowerCase()
        )
        console.log(`Looking for persona with previousName "${update.previousName}":`, existingPersona ? 'FOUND' : 'NOT FOUND')
      }

      // If no previousName match, look for exact name match
      if (!existingPersona) {
        existingPersona = this.personas.find(p => 
          p.name.trim().toLowerCase() === update.name.trim().toLowerCase()
        )
        console.log(`Looking for persona with name "${update.name}":`, existingPersona ? 'FOUND' : 'NOT FOUND')
      }

      if (existingPersona) {
        // Update existing persona
        console.log(`Updating existing persona "${existingPersona.name}" to "${update.name}"`)
        await this.updatePersona(existingPersona.id, {
          name: update.name,
          northStar: update.northStar,
        })
      } else {
        // Create new persona only if we don't already have one with this name
        const duplicateCheck = this.personas.find(p => 
          p.name.trim().toLowerCase() === update.name.trim().toLowerCase()
        )
        
        if (!duplicateCheck) {
          console.log(`Creating new persona "${update.name}"`)
          await this.createPersona(update.name, update.northStar)
        } else {
          console.log(`Skipping creation - persona "${update.name}" already exists`)
        }
      }
    }

    return this.getPersonas()
  }

  /**
   * Save personas to localStorage
   * Skips during SSR when localStorage is not available
   */
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !this.userId) {
      return
    }
    
    try {
      localStorage.setItem(`personas_${this.userId}`, JSON.stringify(this.personas))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }
}
