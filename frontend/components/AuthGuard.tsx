// components/AuthGuard.tsx
"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { authService, User } from '@/services/authService'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean // If false, allows both authenticated and anonymous users
  redirectTo?: string   // Where to redirect if auth is required but user not authenticated
}

export default function AuthGuard({ 
  children, 
  requireAuth = false, 
  redirectTo = '/login' 
}: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = authService.onAuthStateChange((newUser) => {
      setUser(newUser)
      setIsLoading(false)

      // If auth is required and user is not authenticated, redirect to login
      if (requireAuth && !newUser) {
        const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`
        router.push(redirectUrl)
      }
    })

    // Set initial user state
    const currentUser = authService.getCurrentUser()
    setUser(currentUser)
    setIsLoading(false)

    // If auth is required and no user, redirect immediately
    if (requireAuth && !currentUser) {
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`
      router.push(redirectUrl)
    }

    return unsubscribe
  }, [requireAuth, redirectTo, pathname, router])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If auth is required but user is not authenticated, don't render anything
  // (the redirect will happen in useEffect)
  if (requireAuth && !user) {
    return null
  }

  // Render children with user context
  return <>{children}</>
}

// Hook to use auth state in components
export function useAuth() {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser())

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(setUser)
    return unsubscribe
  }, [])

  return {
    user,
    isAuthenticated: !!user,
    signOut: () => authService.signOut(),
  }
}
