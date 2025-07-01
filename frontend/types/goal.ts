export interface Goal {
  id: string
  user_id: string
  persona_id: string | null
  name: string
  acceptance_criteria?: string
  review_date: string // ISO date string
  status: 'active' | 'completed' | 'refined'
  success_percentage: number // 0-100
  review_notes?: string
  created_at: string // ISO date string
}

export interface GoalCreate {
  user_id: string
  persona_id?: string | null
  name: string
  acceptance_criteria?: string
  review_date: string // ISO date string
}

export interface GoalUpdate {
  name?: string
  acceptance_criteria?: string
  review_date?: string
  status?: 'active' | 'completed' | 'refined'
  success_percentage?: number
  review_notes?: string
}