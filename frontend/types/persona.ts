export interface Persona {
  id: string
  name: string
  northStar: string
  createdAt: Date
  updatedAt: Date
}

export interface PersonaUpdate {
  name?: string
  northStar?: string
}
