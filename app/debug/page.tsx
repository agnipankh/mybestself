'use client'

import { toast } from "sonner"

export default function DebugPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="text-[37px]">This is 37px text</div>
      <div className="text-lg">Click below to test toast:</div>
      <button
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
        onClick={() => toast("🎉 Toast is working!")}
      >
        Show Toast
      </button>
    </div>
  )
}
