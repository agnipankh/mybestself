// services/personaMapper.ts
import { Persona } from '../types/persona'
import { BackendPersona, CreatePersonaRequest, UpdatePersonaRequest } from './apiClient'

export class PersonaMapper {
  /**
   * Convert backend persona to frontend persona
   */
  static toFrontend(backendPersona: BackendPersona): Persona {
    return {
      id: backendPersona.id,
      name: backendPersona.label, // Backend uses 'label', frontend uses 'name'
      northStar: backendPersona.north_star,
      createdAt: new Date(backendPersona.created_at),
      updatedAt: new Date(backendPersona.updated_at),
    }
  }

  /**
   * Convert frontend persona to backend create request
   */
  static toBackendCreate(persona: Persona, userId: string): CreatePersonaRequest {
    return {
      user_id: userId,
      label: persona.name,
      north_star: persona.northStar,
      is_calling: false, // Default value, can be customized later
    }
  }

  /**
   * Convert frontend persona update to backend update request
   * Fixed: Now uses UpdatePersonaRequest type and correct field mapping
   */
  static toBackendUpdate(persona: Partial<Persona>): UpdatePersonaRequest {
    const update: UpdatePersonaRequest = {}
    
    if (persona.name !== undefined) {
      update.label = persona.name
    }
    
    if (persona.northStar !== undefined) {
      update.north_star = persona.northStar
    }
    
    // Note: is_calling is not typically updated from the frontend
    // but you can add it here if needed
    
    return update
  }

  /**
   * Convert multiple backend personas to frontend personas
   */
  static toFrontendList(backendPersonas: BackendPersona[]): Persona[] {
    return backendPersonas.map(this.toFrontend)
  }
}
