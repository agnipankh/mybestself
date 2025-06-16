"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PersonaService } from '../services/personaService'
import { ChatService } from '@/services/chatService'
import { Persona } from '../types/persona'
import { ChatMessage } from '../types/chat'
import { useAuth } from '@/components/AuthGuard' // ✅ Add this import

export default function SetupIdentityPage() {
  // ✅ All hooks must be called at the top level consistently
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  
  // Services - using refs to maintain instances across renders
  const personaService = useRef(new PersonaService(9))
  const chatService = useRef(new ChatService())

  // State - always declare these, regardless of loading state
  const [personas, setPersonas] = useState<Persona[]>([])
  const [userInput, setUserInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => 
    chatService.current.getMessages()
  )
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Debounced update function for real-time edits
  const updateTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Handle client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize personas from localStorage
  useEffect(() => {
    if (!mounted || authLoading) return // Wait for both hydration AND auth

    const initializePersonas = async () => {
      setInitializing(true)
      setError(null)
      
      const result = await personaService.current.initialize()
      
      if (result.success && result.data) {
        setPersonas(result.data)
      } else {
        setError(result.error || 'Failed to load personas')
        // Still show any personas that might exist
        setPersonas(personaService.current.getPersonas())
      }
      
      setInitializing(false)
    }

    initializePersonas()
  }, [mounted, authLoading]) // ✅ Wait for both mounted AND auth to be ready

  // Handle chat message sending
  const sendMessage = async () => {
    if (!userInput.trim()) return

    setLoading(true)
    setError(null)
    
    try {
      const result = await chatService.current.sendMessage(userInput)
      setUserInput("")
      setChatMessages(chatService.current.getMessages())

      if (result.success && result.coachReply) {
        // Parse and apply persona updates
        const updates = personaService.current.parsePersonaUpdates(result.coachReply)
        if (updates.length > 0) {
          console.log('Applying persona updates:', updates)
          const updatedPersonas = await personaService.current.applyUpdates(updates)
          setPersonas(updatedPersonas)
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setError('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle persona updates with debouncing for real-time edits
  const updatePersona = (id: string, field: 'name' | 'northStar', value: string) => {
    // Update UI immediately for responsive feel
    setPersonas(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ))

    // Clear existing timeout for this persona+field
    const timeoutKey = `${id}-${field}`
    const existingTimeout = updateTimeouts.current.get(timeoutKey)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout to save after user stops typing
    const newTimeout = setTimeout(async () => {
      const result = await personaService.current.updatePersona(id, { [field]: value })
      if (!result.success) {
        console.error('Failed to update persona:', result.error)
        setError(`Failed to save changes: ${result.error}`)
        // Revert to original value if update failed
        setPersonas(personaService.current.getPersonas())
      }
      updateTimeouts.current.delete(timeoutKey)
    }, 1000) // 1 second delay

    updateTimeouts.current.set(timeoutKey, newTimeout)
  }

  // Handle persona removal
  const removePersona = async (id: string) => {
    const result = await personaService.current.removePersona(id)
    if (result.success) {
      setPersonas(personaService.current.getPersonas())
    } else {
      setError(`Failed to remove persona: ${result.error}`)
    }
  }

  // ✅ Show loading state if auth is loading OR component is initializing
  if (authLoading || !mounted || initializing) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Loading auth...' : 'Loading your personas...'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      {/* Auth Status Banner (Optional) */}
      {user && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-blue-800">Signed in - your personas are synced across devices</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setError(null)}
            className="text-red-800 border-red-400 hover:bg-red-200"
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Chat Panel */}
        <div className="w-1/3 bg-white p-4 rounded-xl shadow h-[80vh] flex flex-col">
          {/* User status in chat header */}
          <div className="mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${user ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="text-sm text-gray-600">
                  {user ? 'Synced' : 'Local only'}
                </span>
              </div>
              {!user && (
                <a 
                  href="/login" 
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Sign in to sync
                </a>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.from === "user"
                    ? "text-right text-blue-600 bg-blue-100 ml-4"
                    : "text-left text-gray-700 bg-gray-100 mr-4"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {msg.from === "user" ? "You" : "Coach"}
                </div>
                <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
              </div>
            ))}
            {loading && (
              <div className="text-center p-3">
                <div className="inline-block animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="ml-2 text-sm text-gray-500">Coach is thinking...</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Describe yourself, your roles, your aspirations..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              className="bg-gray-50"
              disabled={loading}
            />
            <Button 
              onClick={sendMessage} 
              disabled={loading || !userInput.trim()} 
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {loading ? "..." : "Send"}
            </Button>
          </div>
        </div>

        {/* Personas Panel */}
        <div className="w-2/3 bg-white rounded-xl shadow p-6 h-[80vh] overflow-y-auto">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Your Personas</h2>
            <div className="flex items-center gap-3">
              {user && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  Cloud Synced
                </span>
              )}
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {personas.length}/9
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {personas.map(persona => (
              <Card key={persona.id} className="bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 border-gray-200">
                <CardContent className="p-4">
                  <Input
                    value={persona.name}
                    onChange={e => updatePersona(persona.id, 'name', e.target.value)}
                    className="mb-3 bg-white border-gray-300 font-medium text-gray-800"
                    placeholder="Persona name"
                  />
                  <textarea
                    value={persona.northStar}
                    onChange={e => updatePersona(persona.id, 'northStar', e.target.value)}
                    className="w-full text-sm bg-white border border-gray-300 rounded-md p-3 resize-none mb-3 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    rows={4}
                    placeholder="What drives this persona? What are their core values and goals?"
                  />
                  <div className="flex justify-between items-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => removePersona(persona.id)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                    <span className="text-xs text-gray-400">
                      {persona.updatedAt.toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {personas.length === 0 && (
            <div className="text-center text-gray-500 mt-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No personas yet</h3>
              <p className="text-gray-500">Start chatting with the coach to discover and define your different personas!</p>
              {!user && (
                <p className="text-gray-400 text-sm mt-2">
                  💡 <a href="/login" className="text-blue-500 hover:underline">Sign in</a> to save your personas across devices
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Debug Panel (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <details>
            <summary className="text-sm font-medium text-yellow-800 cursor-pointer">
              Debug Info (Dev Only)
            </summary>
            <pre className="mt-2 text-xs text-yellow-700 overflow-auto">
              {JSON.stringify({ 
                personaCount: personas.length,
                user: user ? { id: user.id, email: user.email } : null,
                isAuthenticated,
                authLoading,
                personas: personas.map(p => ({...p, id: p.id}))
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </main>
  )
}
