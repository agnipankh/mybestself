// components/AuthGuard.tsx
"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authService, User } from '@/services/authService'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export default function AuthGuard({ 
  children, 
  requireAuth = false, 
  redirectTo = '/login' 
}: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true) // ✅ Start with loading
  const [mounted, setMounted] = useState(false)    // ✅ Add mounted state
  const router = useRouter()
  const pathname = usePathname()

  // ✅ Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return // ✅ Don't run until mounted

    const unsubscribe = authService.onAuthStateChange((newUser) => {
      setUser(newUser)
      setIsLoading(false)

      if (requireAuth && !newUser) {
        const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`
        router.push(redirectUrl)
      }
    })

    // Set initial user state
    const currentUser = authService.getCurrentUser()
    setUser(currentUser)
    setIsLoading(false)

    if (requireAuth && !currentUser) {
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`
      router.push(redirectUrl)
    }

    return unsubscribe
  }, [mounted, requireAuth, redirectTo, pathname, router])

  // ✅ Show consistent loading state during SSR and initial load
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If auth is required but user is not authenticated, don't render
  if (requireAuth && !user) {
    return null
  }

  return <>{children}</>
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    setUser(authService.getCurrentUser())
    const unsubscribe = authService.onAuthStateChange(setUser)
    return unsubscribe
  }, [mounted])

  return {
    user: mounted ? user : null,
    isAuthenticated: mounted ? !!user : false,
    signOut: () => authService.signOut(),
    isLoading: !mounted // ✅ This is what prevents hydration errors
  }
}
