// lib/api.ts
import axios from "axios"

const API_BASE = "http://localhost:8000" // change if needed

export const requestLoginOTP = async (email: string) => {
  const response = await axios.post(`${API_BASE}/auth/request`, { email })
  return response.data
}

