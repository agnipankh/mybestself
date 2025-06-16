// services/AuthAwarePersonaService.ts
import { Persona, PersonaUpdate } from '../types/persona'
import { authService, User } from './authService'
import { apiClient } from './apiClient'
import { PersonaMapper } from './personaMapper'

export interface PersonaServiceResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

export class AuthAwarePersonaService {
  private personas: Persona[] = []
  private maxPersonas: number
  private user: User | null = null
  private syncInterval: NodeJS.Timeout | null = null
  private readonly SYNC_INTERVAL_MS = 30000 // 30 seconds
  private readonly LOCAL_STORAGE_KEY = 'personas_local'
  private lastSyncTimestamp = 0
  private pendingChanges = false

  constructor(maxPersonas: number = 9) {
    this.maxPersonas = maxPersonas
    this.setupAuthListener()
    this.startPeriodicSync()
  }

  /**
   * Listen for authentication changes and handle sync
   */
  private setupAuthListener(): void {
    authService.onAuthStateChange(async (user) => {
      const wasAnonymous = !this.user
      this.user = user
      
      if (user && wasAnonymous) {
        // User just logged in - migrate local data to cloud
        await this.migrateLocalToCloud()
      } else if (!user) {
        // User logged out - continue with local storage
        await this.loadFromLocal()
      } else if (user) {
        // User was already logged in - load from cloud
        await this.loadFromCloud()
      }
    })
  }

  /**
   * Start periodic sync for authenticated users
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(async () => {
      if (this.user && this.pendingChanges) {
        console.log('🔄 Periodic sync triggered')
        await this.syncToCloud()
      }
    }, this.SYNC_INTERVAL_MS)
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<PersonaServiceResult<Persona[]>> {
    if (typeof window === 'undefined') {
      return { success: true, data: [] }
    }

    this.user = authService.getCurrentUser()
    
    if (this.user) {
      // Authenticated - load from cloud
      return await this.loadFromCloud()
    } else {
      // Anonymous - load from local storage
      return await this.loadFromLocal()
    }
  }

  /**
   * Load personas from local storage
   */
  private async loadFromLocal(): Promise<PersonaServiceResult<Persona[]>> {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY)
      if (stored) {
        const parsedPersonas = JSON.parse(stored)
        this.personas = parsedPersonas.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }))
        console.log('📱 Loaded from local storage:', this.personas.length, 'personas')
      }
      return { success: true, data: this.personas }
    } catch (error) {
      console.error('Failed to load from local storage:', error)
      return { success: false, error: 'Failed to load local personas' }
    }
  }

  /**
   * Load personas from cloud
   */
  private async loadFromCloud(): Promise<PersonaServiceResult<Persona[]>> {
    if (!this.user) {
      return await this.loadFromLocal()
    }

    try {
      console.log('☁️ Loading from cloud for user:', this.user.id)
      const backendPersonas = await apiClient.getPersonas(this.user.id)
      this.personas = PersonaMapper.toFrontendList(backendPersonas)
      this.lastSyncTimestamp = Date.now()
      this.pendingChanges = false
      
      // Also save to local storage as backup
      this.saveToLocal()
      
      console.log('☁️ Loaded from cloud:', this.personas.length, 'personas')
      return { success: true, data: this.personas }
    } catch (error) {
      console.error('Failed to load from cloud, falling back to local:', error)
      // Fallback to local storage if cloud fails
      return await this.loadFromLocal()
    }
  }

  /**
   * Migrate local storage data to cloud when user logs in
   */
  private async migrateLocalToCloud(): Promise<void> {
    if (!this.user) return

    try {
      console.log('🔄 Migrating local personas to cloud...')
      
      // Load local personas
      const localResult = await this.loadFromLocal()
      if (!localResult.success || !localResult.data) return

      const localPersonas = localResult.data
      
      if (localPersonas.length === 0) {
        // No local data to migrate, just load from cloud
        await this.loadFromCloud()
        return
      }

      // Check if user already has cloud personas
      const cloudPersonas = await apiClient.getPersonas(this.user.id)
      
      if (cloudPersonas.length === 0) {
        // No cloud data - migrate all local personas
        console.log('📤 Migrating', localPersonas.length, 'local personas to cloud')
        
        for (const persona of localPersonas) {
          try {
            const backendPersona = await apiClient.createPersona(
              PersonaMapper.toBackendCreate(persona, this.user.id)
            )
            console.log('✅ Migrated persona:', persona.name)
          } catch (error) {
            console.error('❌ Failed to migrate persona:', persona.name, error)
          }
        }
        
        // Reload from cloud to get the new IDs
        await this.loadFromCloud()
        
        // Clear local storage after successful migration
        localStorage.removeItem(this.LOCAL_STORAGE_KEY)
        console.log('🗑️ Cleared local storage after migration')
        
      } else {
        // User has both local and cloud data - prefer cloud
        console.log('⚠️ User has both local and cloud personas, using cloud data')
        await this.loadFromCloud()
      }
      
    } catch (error) {
      console.error('Migration failed:', error)
      // Continue with local storage if migration fails
    }
  }

  /**
   * Save personas to local storage
   */
  private saveToLocal(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(this.personas))
      console.log('💾 Saved to local storage')
    } catch (error) {
      console.error('Failed to save to local storage:', error)
    }
  }

  /**
   * Sync current personas to cloud
   */
  private async syncToCloud(): Promise<PersonaServiceResult> {
    if (!this.user) {
      // Not authenticated - just save locally
      this.saveToLocal()
      return { success: true }
    }

    try {
      console.log('☁️ Syncing', this.personas.length, 'personas to cloud...')
      
      // Get current cloud state
      const cloudPersonas = await apiClient.getPersonas(this.user.id)
      const cloudMap = new Map(cloudPersonas.map(p => [p.label, p]))
      
      // Sync each local persona
      for (const persona of this.personas) {
        const cloudPersona = cloudMap.get(persona.name)
        
        if (cloudPersona) {
          // Update existing
          if (persona.updatedAt.getTime() > new Date(cloudPersona.updated_at).getTime()) {
            await apiClient.updatePersona(
              cloudPersona.id, 
              PersonaMapper.toBackendUpdate(persona)
            )
            console.log('📝 Updated cloud persona:', persona.name)
          }
        } else {
          // Create new
          await apiClient.createPersona(
            PersonaMapper.toBackendCreate(persona, this.user.id)
          )
          console.log('✨ Created cloud persona:', persona.name)
        }
      }
      
      // Remove cloud personas that don't exist locally
      const localNames = new Set(this.personas.map(p => p.name))
      for (const cloudPersona of cloudPersonas) {
        if (!localNames.has(cloudPersona.label)) {
          await apiClient.deletePersona(this.user.id, cloudPersona.label)
          console.log('🗑️ Deleted cloud persona:', cloudPersona.label)
        }
      }
      
      this.lastSyncTimestamp = Date.now()
      this.pendingChanges = false
      
      // Also update local storage
      this.saveToLocal()
      
      console.log('✅ Cloud sync completed')
      return { success: true }
      
    } catch (error) {
      console.error('❌ Cloud sync failed:', error)
      // Still save locally even if cloud sync fails
      this.saveToLocal()
      return { success: false, error: 'Cloud sync failed, saved locally' }
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

    const newPersona: Persona = {
      id: `persona-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      northStar,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.personas.push(newPersona)
    this.pendingChanges = true
    
    // Immediate save/sync
    if (this.user) {
      // Try cloud first, fallback to local
      const result = await this.syncToCloud()
      if (!result.success) {
        this.saveToLocal()
      }
    } else {
      this.saveToLocal()
    }
    
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
    this.pendingChanges = true
    
    // For updates, we can be more lazy - just mark as pending
    // The periodic sync will handle it, or immediate sync on create
    this.saveToLocal()
    
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
    this.pendingChanges = true
    
    // Immediate sync for deletions
    if (this.user) {
      await this.syncToCloud()
    } else {
      this.saveToLocal()
    }
    
    return { success: true }
  }

  /**
   * Parse persona updates from coach response
   */
  parsePersonaUpdates(coachReply: string): Array<{ name: string; northStar: string; previousName?: string }> {
    const updates: Array<{ name: string; northStar: string; previousName?: string }> = []
    const matches = [...coachReply.matchAll(/Persona:\s*(.*?)\s*(?:\(was:\s*(.*?)\s*\))?\s*\n\s*North Star:\s*(.*?)(?:\n|$)/gi)]

    for (const [, newName, oldName, northStar] of matches) {
      updates.push({
        name: newName.trim(),
        northStar: northStar.trim(),
        previousName: oldName?.trim(),
      })
    }

    return updates
  }

  /**
   * Apply parsed updates from coach
   */
  async applyUpdates(updates: Array<{ name: string; northStar: string; previousName?: string }>): Promise<Persona[]> {
    for (const update of updates) {
      let existingPersona: Persona | undefined

      if (update.previousName) {
        existingPersona = this.personas.find(p => 
          p.name.trim().toLowerCase() === update.previousName!.trim().toLowerCase()
        )
      }

      if (!existingPersona) {
        existingPersona = this.personas.find(p => 
          p.name.trim().toLowerCase() === update.name.trim().toLowerCase()
        )
      }

      if (existingPersona) {
        await this.updatePersona(existingPersona.id, {
          name: update.name,
          northStar: update.northStar,
        })
      } else {
        const duplicateCheck = this.personas.find(p => 
          p.name.trim().toLowerCase() === update.name.trim().toLowerCase()
        )
        
        if (!duplicateCheck) {
          await this.createPersona(update.name, update.northStar)
        }
      }
    }

    return this.getPersonas()
  }

  /**
   * Force immediate sync to cloud
   */
  async forceSyncToCloud(): Promise<PersonaServiceResult> {
    return await this.syncToCloud()
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isAuthenticated: boolean
    lastSyncTime: Date | null
    hasPendingChanges: boolean
  } {
    return {
      isAuthenticated: !!this.user,
      lastSyncTime: this.lastSyncTimestamp ? new Date(this.lastSyncTimestamp) : null,
      hasPendingChanges: this.pendingChanges
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
  }
}
