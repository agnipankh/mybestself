// services/personaMapper.ts
import { Persona } from '../types/persona'
import { BackendPersona, CreatePersonaRequest } from './apiClient'

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
   */
  static toBackendUpdate(persona: Partial<Persona>): Partial<CreatePersonaRequest> {
    const update: Partial<CreatePersonaRequest> = {}
    
    if (persona.name !== undefined) {
      update.label = persona.name
    }
    
    if (persona.northStar !== undefined) {
      update.north_star = persona.northStar
    }
    
    return update
  }

  /**
   * Convert multiple backend personas to frontend personas
   */
  static toFrontendList(backendPersonas: BackendPersona[]): Persona[] {
    return backendPersonas.map(this.toFrontend)
  }
}
