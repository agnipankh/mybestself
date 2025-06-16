// app/page.tsx
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          My Best Self
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Discover and define your multiple personas with AI guidance
        </p>
        <div className="space-x-4">
          <Link href="/mbs">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Try the App
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
