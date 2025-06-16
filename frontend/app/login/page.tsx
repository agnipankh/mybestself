// app/login/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { authService } from "@/services/authService"

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" })
})

const tokenSchema = z.object({
  token: z.string().min(6, "Token must be at least 6 characters")
})

type EmailFormData = z.infer<typeof emailSchema>
type TokenFormData = z.infer<typeof tokenSchema>

export default function LoginPage() {
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors, isSubmitting: sendingEmail }
  } = useForm<EmailFormData>({ resolver: zodResolver(emailSchema) })

  const {
    register: registerToken,
    handleSubmit: handleSubmitToken,
    formState: { errors: tokenErrors, isSubmitting: verifyingToken }
  } = useForm<TokenFormData>({ resolver: zodResolver(tokenSchema) })

  // Check if user is already authenticated
  useEffect(() => {
    if (authService.isAuthenticated()) {
      // User is already logged in, redirect to main app
      const redirectTo = searchParams.get("redirect") || "/mbs"  // Change to /mbs
      router.push(redirectTo)
    }
  }, [router])

  // Handle magic link token from URL
  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      handleTokenSubmit({ token })
    }
  }, [searchParams])

  const handleEmailSubmit = async (data: EmailFormData) => {
    try {
      const result = await authService.requestMagicLink(data.email)
      
      if (result.success) {
        setEmailSent(true)
        setSentEmail(data.email)
        toast.success("Magic link sent to your email ✨")
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      toast.error("Failed to send email")
    }
  }

  const handleTokenSubmit = async (data: TokenFormData) => {
    try {
      const result = await authService.verifyMagicLink(data.token)

      if (result.success && result.user) {
        toast.success("Login successful 🚀")
        
        // Clear token from URL if it was passed via URL
        if (searchParams.get("token")) {
          window.history.replaceState({}, document.title, "/login")
        }
        
        // Check if user has any existing persona data to migrate
        // This will be handled automatically by the AuthAwarePersonaService
        
        // Redirect to main app
        const redirectTo = searchParams.get("redirect") || "/"
        router.push(redirectTo)
      } else {
        toast.error(result.error || "Authentication failed")
      }
    } catch (err) {
      toast.error("Invalid or expired token")
    }
  }

  const handleBackToEmail = () => {
    setEmailSent(false)
    setSentEmail("")
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-[400px] bg-white rounded-xl shadow-lg p-6 flex flex-col justify-center">
        <div className="space-y-6">
          {/* App Branding */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">MyBestSelf</h1>
            <p className="text-gray-600 text-sm">Sign in to sync your personas across devices</p>
          </div>

          {emailSent ? (
            /* Token Input Variant */
            <div data-variant="token" className="space-y-4">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-medium text-gray-900">Check your email</h3>
                <p className="text-sm text-gray-600">
                  We sent a magic link to <strong>{sentEmail}</strong>
                </p>
              </div>

              <form onSubmit={handleSubmitToken(handleTokenSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or paste the token from your email:
                  </label>
                  <Input 
                    type="text" 
                    placeholder="Enter token" 
                    {...registerToken("token")} 
                    className="bg-gray-50 border border-gray-300 rounded-lg"
                  />
                  {tokenErrors.token && (
                    <p className="text-red-600 text-sm mt-1">{tokenErrors.token.message}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  disabled={verifyingToken} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
                >
                  {verifyingToken ? "Verifying..." : "Verify Token"}
                </Button>
              </form>

              <Button 
                variant="ghost" 
                onClick={handleBackToEmail}
                className="w-full text-gray-600 hover:text-gray-800"
              >
                ← Use different email
              </Button>
            </div>
          ) : (
            /* Email Input Variant */
            <div data-variant="email" className="space-y-4">
              <form onSubmit={handleSubmitEmail(handleEmailSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    {...registerEmail("email")}
                    placeholder="you@example.com"
                    className="bg-gray-50 border border-gray-300 rounded-lg"
                  />
                  {emailErrors.email && (
                    <p className="text-red-600 text-sm mt-1">{emailErrors.email.message}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  disabled={sendingEmail} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
                >
                  {sendingEmail ? "Sending..." : "Send Magic Link"}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-xs text-gray-500">
                  We'll send you a magic link to sign in instantly. No password needed!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
