"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { requestLoginOTP } from "@/lib/api"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const { toast, ToastComponent } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await requestLoginOTP(email)
      toast({ title: "Check your inbox", description: "We sent you a login link!" })
    } catch (err) {
      toast({ title: "Login failed", description: "Could not send OTP", variant: "destructive" })
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto mt-10">
        <Input
          type="email"
          value={email}
          placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit">Send Login Code</Button>
      </form>
      <ToastComponent />
    </>
  )
}

