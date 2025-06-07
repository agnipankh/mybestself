'use client'


import { useEffect, useState } from "react"

interface ToastOptions {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const [toast, setToast] = useState<ToastOptions | null>(null)

  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timeout)
    }
  }, [toast])

  return {
    toast: (opts: ToastOptions) => setToast(opts),
    ToastComponent: () =>
      toast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded shadow text-white ${
            toast.variant === "destructive" ? "bg-red-500" : "bg-gray-900"
          }`}
        >
          <strong>{toast.title}</strong>
          {toast.description && <p>{toast.description}</p>}
        </div>
      ) : null,
  }
}

