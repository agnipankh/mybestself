export interface Persona {
  id: string
  name: string
  northStar: string
  createdAt: Date
  updatedAt: Date
}

xport interface PersonaUpdate {
  name?: string
  northStar?: string
}
