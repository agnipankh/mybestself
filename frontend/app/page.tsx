// app/login/page.tsx (Next.js 13+ with App Router)

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

const formSchema = z.object({
  email: z.string().email("Please enter a valid email")
})

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(formSchema)
  })

  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      const res = await fetch('/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        setSent(true)
        toast({ title: 'Check your email ✉️', description: 'We sent you a magic link.' })
      } else {
        const err = await res.json()
        toast({ title: 'Oops', description: err.detail || 'Something went wrong', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Network error', description: 'Please try again later.', variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md p-6 text-center shadow-xl">
        <CardContent>
          <h1 className="text-2xl font-semibold mb-4">Sign in to MyBestSelf</h1>
          {sent ? (
            <p className="text-green-700">Check your email for the login link.</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input type="email" placeholder="you@example.com" {...register("email")}/>
              {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                Send me a magic link
              </Button>
            </form>
          )}
          <p className="mt-4 text-xs text-muted-foreground">No passwords. Just your inbox 💌</p>
        </CardContent>
      </Card>
    </div>
  )
}

