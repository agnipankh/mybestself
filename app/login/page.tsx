// app/login/page.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import axios from "axios"

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

  const handleEmailSubmit = async (data: EmailFormData) => {
    try {
      await axios.post("http://localhost:8000/auth/request", data)
      setEmailSent(true)
      toast.success("Magic link sent to your email ✨")
    } catch (err) {
      toast.error("Failed to send email")
    }
  }

  const handleTokenSubmit = async (data: TokenFormData) => {
    try {
      await axios.get("http://localhost:8000/auth/verify", {
        params: { token: data.token }
      })
      toast.success("Login successful 🚀")
      // Optionally, store token or redirect
    } catch (err) {
      toast.error("Invalid or expired token")
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-6">
          <h1 className="text-2xl font-bold">Log In</h1>
          {emailSent ? (
            <form onSubmit={handleSubmitToken(handleTokenSubmit)} className="space-y-4">
              <p className="text-muted-foreground text-sm">Paste the token from your email:</p>
              <Input type="text" placeholder="Enter token" {...registerToken("token")} />
              {tokenErrors.token && (
                <p className="text-destructive text-sm mt-1">{tokenErrors.token.message}</p>
              )}
              <Button type="submit" disabled={verifyingToken} className="w-full">
                {verifyingToken ? "Verifying..." : "Verify Token"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmitEmail(handleEmailSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  {...registerEmail("email")}
                  className="mt-1"
                  placeholder="you@example.com"
                />
                {emailErrors.email && (
                  <p className="text-destructive text-sm mt-1">{emailErrors.email.message}</p>
                )}
              </div>
              <Button type="submit" disabled={sendingEmail} className="w-full">
                {sendingEmail ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

