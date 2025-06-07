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
      const res = await axios.get("http://localhost:8000/auth/verify", {
        params: { token: data.token }
      })

      // Save JWT token (if returned by backend)
      const token = res.data?.access_token || res.data?.token
      if (token) {
        localStorage.setItem("authToken", token)
      }

      toast.success("Login successful 🚀")
      router.push("/dashboard") // or your target page
    } catch (err) {
      toast.error("Invalid or expired token")
    }
  }

  useEffect(() => {
    const token = searchParams.get("token")
    if (token) {
      handleTokenSubmit({ token })
    }
  }, [searchParams])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
       <div className="w-[400px] h-[400px] bg-white rounded-xl shadow-lg p-6 flex flex-col justify-center">
         <div className = "space-y-6">
          {emailSent ? (
           <div data-variant="token" className="space-y-4">
                <form onSubmit={handleSubmitToken(handleTokenSubmit)} className="space-y-2">
                    <p className="block text-sm font-medium text-gray-400">Paste the token from your email:</p>
                    <Input type="text" placeholder="Enter token" {...registerToken("token")} 
                    className="bg-gray-300 border-0 rounded-lg focus:ring-0 focus:bg-gray-200"
                    />
                    {tokenErrors.token && (
                        <p className="text-destructive text-sm mt-1">{tokenErrors.token.message}</p>
                    )}
                    <Button type="submit" disabled={verifyingToken} className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg">
                        {verifyingToken ? "Verifying..." : "Verify Token"}
                    </Button>
                </form>
            </div>
          ) : (
      /* Variant: Email Input */
            <div data-variant="email" className="space-y-4">
              <form onSubmit={handleSubmitEmail(handleEmailSubmit)} className="space-y-2">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-400">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    {...registerEmail("email")}
                    placeholder="you@example.com"
                    className="bg-gray-300 border-0 rounded-lg focus:ring-0 focus:bg-gray-200 mt-2"
                  />
                  {emailErrors.email && (
                    <p className="text-destructive text-sm mt-1">{emailErrors.email.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={sendingEmail} 
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg">
                  {sendingEmail ? "Sending..." : "Send Magic Link"}
                </Button>
              </form>
            </div>
          )}
      </div>   
    </div>

 </main>
  )
}

