// components/ApiTest.tsx
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/services/apiClient'
import { PersonaMapper } from '@/services/personaMapper'
import { authService } from '@/services/authService'
import { useAuth } from '@/components/AuthGuard'  

export default function ApiTest() {
  const { user, isLoading } = useAuth()
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading auth state...</p>
        </div>
      </div>
    )
  }

  const testCreatePersona = async () => {
    setLoading(true)
    setResult('Testing...')

    try {
      // Get current user ID
      const userId = authService.getUserId()
      if (!userId) {
        setResult('❌ Error: No authenticated user found. Please log in first.')
        return
      }

      console.log('Using userId:', userId)

      // Test: Create a persona
      const createRequest = {
        user_id: userId,
        label: 'Test Persona',
        north_star: 'To test the API connection',
        is_calling: false,
      }

      console.log('Creating persona with:', createRequest)
      const backendPersona = await apiClient.createPersona(createRequest)
      console.log('Backend response:', backendPersona)

      // Test: Convert to frontend format
      const frontendPersona = PersonaMapper.toFrontend(backendPersona)
      console.log('Frontend persona:', frontendPersona)

      setResult(`✅ Success! Created persona:
ID: ${frontendPersona.id}
Name: ${frontendPersona.name}
North Star: ${frontendPersona.northStar}
Created: ${frontendPersona.createdAt.toLocaleString()}`)

    } catch (error) {
      console.error('API Test Error:', error)
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const testGetPersonas = async () => {
    setLoading(true)
    setResult('Testing...')

    try {
      const userId = authService.getUserId()
      if (!userId) {
        setResult('❌ Error: No authenticated user found. Please log in first.')
        return
      }

      console.log('Getting personas for userId:', userId)
      const backendPersonas = await apiClient.getPersonas(userId)
      console.log('Backend personas:', backendPersonas)

      const frontendPersonas = PersonaMapper.toFrontendList(backendPersonas)
      console.log('Frontend personas:', frontendPersonas)

      setResult(`✅ Success! Found ${frontendPersonas.length} personas:
${frontendPersonas.map(p => `• ${p.name}: ${p.northStar}`).join('\n')}`)

    } catch (error) {
      console.error('API Test Error:', error)
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const clearResult = () => {
    setResult('')
  }

  const currentUser = authService.getCurrentUser()

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">API Connection Test</h2>
      
      {/* Auth Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold mb-2">Authentication Status:</h3>
        {currentUser ? (
          <div className="text-green-600">
            ✅ Authenticated as User ID: {currentUser.id}
          </div>
        ) : (
          <div className="text-red-600">
            ❌ Not authenticated. Please log in first at <a href="/login" className="underline">/login</a>
          </div>
        )}
      </div>

      {/* Test Buttons */}
      <div className="space-y-4 mb-6">
        <Button 
          onClick={testCreatePersona}
          disabled={loading || !currentUser}
          className="w-full"
        >
          {loading ? 'Testing...' : 'Test: Create Persona'}
        </Button>
        
        <Button 
          onClick={testGetPersonas}
          disabled={loading || !currentUser}
          variant="outline"
          className="w-full"
        >
          {loading ? 'Testing...' : 'Test: Get All Personas'}
        </Button>

        <Button 
          onClick={clearResult}
          variant="ghost"
          className="w-full"
        >
          Clear Result
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="p-4 bg-gray-100 rounded border">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="text-sm whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        <p>Open browser console (F12) to see detailed logs</p>
      </div>
    </div>
  )
}
