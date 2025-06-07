'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

export default function UiTestPage() {
  const { toast, ToastComponent } = useToast()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <Card className="w-full max-w-md p-6 bg-background shadow">
        <CardContent>
          <h2 className="text-2xl font-semibold mb-4">UI Test Page</h2>
          <Input placeholder="This is here..." className="mb-4" />
          <Button
            onClick={() =>
              toast({ title: "Clicked!", description: "This button is alive." })
            }
          >
            Click me
          </Button>
        </CardContent>
      </Card>
      <ToastComponent />
    </div>
  )
}

