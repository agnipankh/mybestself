"use client"

import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthAwarePersonaService } from '@/services/AuthAwarePersonaService'
import { ChatService } from '@/services/chatService'
import { apiClient, BackendGoal, CreateGoalRequest } from '@/services/apiClient'
import { Persona } from '@/types/persona'
import { ChatMessage } from '@/types/chat'
import { useAuth } from '@/components/AuthGuard'
import ReactMarkdown from 'react-markdown'

export default function PersonaGoalsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const personaId = params.personaId as string

  const personaService = useRef(new AuthAwarePersonaService(9))
  const chatService = useRef(new ChatService({
    apiEndpoint: '/api/openai-chat',
    maxMessages: 50,
    enableLogging: true,
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
  }))

  const [persona, setPersona] = useState<Persona | null>(null)
  const [goals, setGoals] = useState<BackendGoal[]>([])
  const [userInput, setUserInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  // Goal creation state
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [newGoal, setNewGoal] = useState({
    name: '',
    acceptance_criteria: '',
    review_date: '',
    planned_hours: 0,
    actual_hours: 0
  })
  
  // Goal editing state
  const [editingGoal, setEditingGoal] = useState<string | null>(null)

  const chatMessagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      const scrollElement = chatMessagesRef.current
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [chatMessages, loading])

  // Helper function to manually scroll to bottom
  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  useEffect(() => {
    if (!mounted || authLoading || !personaId) return

    const initializeData = async () => {
      setInitializing(true)
      setError(null)
      
      try {
        // Initialize persona service
        const personaResult = await personaService.current.initialize()
        let foundPersona = null
        
        if (personaResult.success && personaResult.data) {
          foundPersona = personaResult.data.find(p => p.id === personaId)
          if (foundPersona) {
            setPersona(foundPersona)
          } else {
            throw new Error('Persona not found')
          }
        } else {
          throw new Error(personaResult.error || 'Failed to load personas')
        }

        // Initialize chat service with goal-setting context
        if (user?.id && foundPersona) {
          await chatService.current.initialize(user.id)
          
          // Start goal conversation with empty messages and proper context
          await chatService.current.startGoalConversation(foundPersona)
        }
        
        setChatMessages(chatService.current.getMessages())

        // Load existing goals for this persona
        if (personaId) {
          const personaGoals = await apiClient.getPersonaGoals(personaId)
          setGoals(personaGoals)
        }
        
      } catch (error: any) {
        console.error('Initialization error:', error)
        setError(`Failed to load data: ${error.message}`)
      } finally {
        setInitializing(false)
      }
    }

    initializeData()
  }, [mounted, authLoading, user?.id, personaId])

  const sendMessage = async () => {
    if (!userInput.trim()) return

    setLoading(true)
    setError(null)
    
    try {
      const result = await chatService.current.sendMessage(userInput)
      setUserInput("")
      setChatMessages(chatService.current.getMessages())

      // Handle goal actions if any were created
      if (result.success && result.goalActions && result.goalActions.length > 0) {
        console.log('Processing goal actions:', result.goalActions)
        
        for (const goalAction of result.goalActions) {
          if (goalAction.type === 'create' && user?.id) {
            try {
              const goalData: CreateGoalRequest = {
                user_id: user.id,
                persona_id: personaId,
                name: goalAction.name,
                acceptance_criteria: goalAction.acceptanceCriteria,
                review_date: goalAction.reviewDate
              }

              const createdGoal = await apiClient.createGoal(goalData)
              setGoals(prev => [...prev, createdGoal])
              console.log('Goal created successfully:', createdGoal)
            } catch (goalError) {
              console.error('Failed to create goal:', goalError)
              setError('Goal was identified but failed to save. Please try again.')
            }
          } else if (goalAction.type === 'update' && goalAction.originalName) {
            try {
              // Find the existing goal by name
              const existingGoal = goals.find(g => 
                g.name.toLowerCase().trim() === goalAction.originalName?.toLowerCase().trim()
              )
              
              if (existingGoal) {
                const updatedGoal = await apiClient.updateGoal(existingGoal.id, {
                  name: goalAction.name,
                  acceptance_criteria: goalAction.acceptanceCriteria,
                  review_date: goalAction.reviewDate
                })
                
                setGoals(prev => prev.map(g => 
                  g.id === existingGoal.id ? updatedGoal : g
                ))
                console.log('Goal updated successfully:', updatedGoal)
              } else {
                console.warn('Could not find existing goal to update:', goalAction.originalName)
                setError(`Could not find goal "${goalAction.originalName}" to update.`)
              }
            } catch (goalError) {
              console.error('Failed to update goal:', goalError)
              setError('Goal update was identified but failed to save. Please try again.')
            }
          }
        }
      }

      setTimeout(() => scrollToBottom(), 100)

      if (!result.success) {
        setError(result.error || 'Failed to get response from coach')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setError('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const createGoal = async () => {
    if (!user?.id || !newGoal.name.trim() || !newGoal.review_date) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const goalData: CreateGoalRequest = {
        user_id: user.id,
        persona_id: personaId,
        name: newGoal.name,
        acceptance_criteria: newGoal.acceptance_criteria || undefined,
        review_date: newGoal.review_date,
        planned_hours: newGoal.planned_hours,
        actual_hours: newGoal.actual_hours
      }

      const createdGoal = await apiClient.createGoal(goalData)
      setGoals(prev => [...prev, createdGoal])
      setNewGoal({ name: '', acceptance_criteria: '', review_date: '', planned_hours: 0, actual_hours: 0 })
      setShowGoalForm(false)
      setError(null)
    } catch (error: any) {
      console.error('Failed to create goal:', error)
      setError(`Failed to create goal: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const updateGoal = async (goalId: string, updates: any) => {
    setLoading(true)
    try {
      const updatedGoal = await apiClient.updateGoal(goalId, updates)
      setGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g))
      setEditingGoal(null)
      setError(null)
    } catch (error: any) {
      console.error('Failed to update goal:', error)
      setError(`Failed to update goal: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const deleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return

    setLoading(true)
    try {
      await apiClient.deleteGoal(goalId)
      setGoals(prev => prev.filter(g => g.id !== goalId))
      setError(null)
    } catch (error: any) {
      console.error('Failed to delete goal:', error)
      setError(`Failed to delete goal: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  // Helper function to get default review date (1 week from now)
  const getDefaultReviewDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().split('T')[0]
  }

  // Custom markdown components for styling
  const MarkdownComponents = {
    strong: ({ children }: any) => (
      <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-gray-700">{children}</em>
    ),
    ul: ({ children }: any) => (
      <ul className="list-none space-y-1 my-2">{children}</ul>
    ),
    li: ({ children }: any) => (
      <li className="flex items-start">
        <span className="text-blue-500 mr-2">•</span>
        <span>{children}</span>
      </li>
    ),
    p: ({ children }: any) => (
      <p className="mb-2 last:mb-0">{children}</p>
    ),
  }

  // Loading state
  if (authLoading || !mounted || initializing) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Loading auth...' : 'Loading persona goals...'}
          </p>
        </div>
      </main>
    )
  }

  if (!persona) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Persona not found</p>
          <Button onClick={() => router.push('/mbs')}>
            Back to Personas
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      {/* Header with persona info */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/mbs')}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            ← Back to Personas
          </Button>
          {user && (
            <span className="text-sm text-gray-500">
              Welcome back, {user.name || user.email}
            </span>
          )}
        </div>
        
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-2xl text-gray-800">{persona.name}</CardTitle>
                <p className="text-gray-600 mt-2">{persona.northStar}</p>
              </div>
              <div className="ml-6 text-right">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importance Level
                </label>
                <select
                  value={persona.importance || 3}
                  onChange={async (e) => {
                    const newImportance = Number(e.target.value)
                    try {
                      // Update persona importance via API
                      await apiClient.updatePersona(persona.id, { importance: newImportance })
                      // Update local state
                      setPersona(prev => prev ? { ...prev, importance: newImportance } : null)
                    } catch (error) {
                      console.error('Failed to update persona importance:', error)
                      setError('Failed to update importance level')
                    }
                  }}
                  className="bg-white border border-gray-300 rounded-md px-3 py-1 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                >
                  <option value={1}>1 - Low</option>
                  <option value={2}>2 - Below Average</option>
                  <option value={3}>3 - Medium</option>
                  <option value={4}>4 - High</option>
                  <option value={5}>5 - Critical</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Used for dashboard priority</p>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

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
        {/* Chat Panel - Goal Setting Context */}
        <div className="w-1/3 bg-white p-4 rounded-xl shadow h-[75vh] flex flex-col">
          <div className="mb-4 pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Goal Setting Coach</h3>
            <p className="text-sm text-gray-600 mt-1">
              Let's explore goals that align with your {persona.name} persona
            </p>
          </div>

          {/* Chat messages */}
          <div 
            ref={chatMessagesRef}
            className="flex-1 overflow-y-auto mb-4 space-y-3"
          >
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
                  <span className="ml-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm">
                  {msg.from === "user" ? (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown components={MarkdownComponents}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-center p-3">
                <div className="inline-block animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="ml-2 text-sm text-gray-500">Coach is thinking...</span>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="flex gap-2">
            <Input
              placeholder="What goals should I set for this persona?"
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

        {/* Goals Panel */}
        <div className="w-2/3 bg-white rounded-xl shadow p-6 h-[75vh] overflow-y-auto">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Goals</h2>
            <Button 
              onClick={() => {
                setShowGoalForm(true)
                setNewGoal(prev => ({ ...prev, review_date: getDefaultReviewDate() }))
              }}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              + Add Goal
            </Button>
          </div>

          {/* Goal Creation Form */}
          {showGoalForm && (
            <Card className="mb-6 border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800">Create New Goal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Goal name"
                  value={newGoal.name}
                  onChange={e => setNewGoal(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-white"
                />
                <textarea
                  placeholder="Success criteria (optional)"
                  value={newGoal.acceptance_criteria}
                  onChange={e => setNewGoal(prev => ({ ...prev, acceptance_criteria: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded-md p-3 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Planned Hours
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Hours you plan to spend"
                      value={newGoal.planned_hours || ''}
                      onChange={e => setNewGoal(prev => ({ ...prev, planned_hours: Number(e.target.value) }))}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Actual Hours
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Hours spent so far"
                      value={newGoal.actual_hours || ''}
                      onChange={e => setNewGoal(prev => ({ ...prev, actual_hours: Number(e.target.value) }))}
                      className="bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Review Date
                  </label>
                  <Input
                    type="date"
                    value={newGoal.review_date}
                    onChange={e => setNewGoal(prev => ({ ...prev, review_date: e.target.value }))}
                    className="bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={createGoal}
                    disabled={loading || !newGoal.name.trim() || !newGoal.review_date}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Create Goal
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowGoalForm(false)
                      setNewGoal({ name: '', acceptance_criteria: '', review_date: '', planned_hours: 0, actual_hours: 0 })
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Goals List */}
          <div className="space-y-4">
            {goals.map(goal => (
              <Card key={goal.id} className="border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800">{goal.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        Review: {formatDate(goal.review_date)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        goal.status === 'active' ? 'bg-green-100 text-green-800' :
                        goal.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {goal.status}
                      </span>
                    </div>
                  </div>
                  
                  {goal.acceptance_criteria && (
                    <p className="text-sm text-gray-600 mb-3">{goal.acceptance_criteria}</p>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Progress:</span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${goal.success_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">{goal.success_percentage}%</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingGoal(editingGoal === goal.id ? null : goal.id)}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        {editingGoal === goal.id ? 'Cancel' : 'Edit'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteGoal(goal.id)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  
                  {editingGoal === goal.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      <Input
                        placeholder="Goal name"
                        defaultValue={goal.name}
                        onBlur={e => e.target.value !== goal.name && updateGoal(goal.id, { name: e.target.value })}
                        className="bg-gray-50"
                      />
                      <textarea
                        placeholder="Success criteria"
                        defaultValue={goal.acceptance_criteria || ''}
                        onBlur={e => e.target.value !== (goal.acceptance_criteria || '') && updateGoal(goal.id, { acceptance_criteria: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-md p-3 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Planned Hours
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            defaultValue={goal.planned_hours || 0}
                            onBlur={e => Number(e.target.value) !== (goal.planned_hours || 0) && updateGoal(goal.id, { planned_hours: Number(e.target.value) })}
                            className="bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Actual Hours
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            defaultValue={goal.actual_hours || 0}
                            onBlur={e => Number(e.target.value) !== (goal.actual_hours || 0) && updateGoal(goal.id, { actual_hours: Number(e.target.value) })}
                            className="bg-gray-50"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Review Date
                          </label>
                          <Input
                            type="date"
                            defaultValue={goal.review_date.split('T')[0]}
                            onBlur={e => e.target.value !== goal.review_date.split('T')[0] && updateGoal(goal.id, { review_date: e.target.value })}
                            className="bg-gray-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            defaultValue={goal.status}
                            onChange={e => updateGoal(goal.id, { status: e.target.value as any })}
                            className="bg-gray-50 border border-gray-300 rounded-md p-2 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="refined">Refined</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Progress %
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={goal.success_percentage}
                            onBlur={e => parseInt(e.target.value) !== goal.success_percentage && updateGoal(goal.id, { success_percentage: parseInt(e.target.value) })}
                            className="bg-gray-50 w-20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Empty state */}
          {goals.length === 0 && !showGoalForm && (
            <div className="text-center text-gray-500 mt-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No goals yet</h3>
              <p className="text-gray-500 mb-4">
                Start by creating goals that align with your {persona.name} persona's north star
              </p>
              <Button 
                onClick={() => {
                  setShowGoalForm(true)
                  setNewGoal(prev => ({ ...prev, review_date: getDefaultReviewDate() }))
                }}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                Create Your First Goal
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}