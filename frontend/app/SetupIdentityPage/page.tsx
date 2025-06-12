"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface Persona {
  id: number
  name: string
  northStar: string
}

export default function SetupIdentityPage() {
  const [personas, setPersonas] = useState<Persona[]>([
    { id: 1, name: "Creative Leader", northStar: "To inspire and empower through design." },
    { id: 2, name: "Disciplined Parent", northStar: "To show up with love and consistency." },
    { id: 3, name: "Curious Learner", northStar: "To grow by exploring new ideas daily." },
    { id: 4, name: "Mindful Friend", northStar: "To be present and supportive in relationships." },
    { id: 5, name: "Healthy Individual", northStar: "To prioritize physical and mental wellness." },
    { id: 6, name: "Visionary Builder", northStar: "To create systems that improve lives." }
  ])

  const [userInput, setUserInput] = useState("")
  const [chatMessages, setChatMessages] = useState([
    {
      from: "coach",
      text: "Let's figure out who you want to become. What are moments in your life when you felt proud, alive, or deeply aligned with your values?"
    }
  ])
  const [loading, setLoading] = useState(false)

  const handlePersonaChange = (index: number, key: keyof Persona, value: string) => {
    const updated = [...personas]
    updated[index][key] = value
    setPersonas(updated)
  }

  const addPersona = () => {
    if (personas.length < 7) {
      setPersonas([...personas, { id: Date.now(), name: "", northStar: "" }])
    }
  }

  const removePersona = (id: number) => {
    setPersonas(personas.filter(p => p.id !== id))
  }

  const handleSave = () => {
    console.log("Saving", personas)
  }

  const sendToOpenAI = async () => {
    if (!userInput.trim()) return
  
    const updatedMessages = [...chatMessages, { from: "user", text: userInput }]
    setChatMessages(updatedMessages)
    setUserInput("")
    setLoading(true)
  
    try {
      const res = await fetch("/api/openai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages })
      })
  
      const data = await res.json()
      console.log("🔵 OpenAI API response:", data)
  
      if (!res.ok || !data.reply) {
        throw new Error(data.error || "OpenAI API returned an error")
      }
  
      setChatMessages([...updatedMessages, { from: "coach", text: data.reply }])
    } catch (err: any) {
      console.error("🔴 OpenAI call failed:", err)
      setChatMessages([
        ...updatedMessages,
        { from: "coach", text: `Sorry, something went wrong: ${err.message || "Unknown error"}` }
      ])
    }
  
    setLoading(false)
  }


  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center">Define Your Personas & North Stars</h1>
        <p className="text-center text-gray-500">Choose a method below to define who you want to become.</p>

        <Tabs defaultValue="manual" className="space-y-6">
          <TabsList className="flex justify-center space-x-4">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="chat">Talk with AI</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona, index) => (
                <Card key={persona.id} className="bg-white p-4 shadow rounded-xl">
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Persona</label>
                      <Input
                        placeholder="e.g. Creative Leader"
                        value={persona.name}
                        onChange={e => handlePersonaChange(index, "name", e.target.value)}
                        className="bg-gray-300 border-0 rounded-lg focus:ring-0 focus:bg-gray-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">North Star</label>
                      <textarea
                        placeholder="e.g. To inspire and empower through design."
                        value={persona.northStar}
                        onChange={e => handlePersonaChange(index, "northStar", e.target.value)}
                        className="w-full min-h-[80px] text-sm bg-gray-300 border-0 rounded-lg focus:ring-0 focus:bg-gray-200 resize-none"
                      />
                    </div>
                    {personas.length > 1 && (
                      <Button variant="destructive" onClick={() => removePersona(persona.id)} className="w-full">
                        Remove
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {personas.length < 7 && (
              <div className="flex justify-center">
                <Button onClick={addPersona} variant="outline">
                  + Add Another Persona
                </Button>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={handleSave} className="bg-gray-700 text-white px-6 py-3 rounded-lg">
                Save & Continue
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="chat">
            <div className="bg-white p-6 rounded-xl shadow space-y-4 max-w-3xl mx-auto">
              <div className="h-64 overflow-y-auto space-y-2 text-sm">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={msg.from === "user"
                    ? "text-right text-blue-600 bg-blue-100 p-2 rounded"
                    : "text-left text-gray-700 bg-gray-100 p-3 rounded"}>
                    <strong>{msg.from === "user" ? "You" : "Coach"}:</strong> {msg.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Type your response..."
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendToOpenAI() }}
                  className="bg-gray-200"
                />
                <Button
                  onClick={sendToOpenAI}
                  disabled={loading}
                  className="bg-gray-700 text-white"
                >
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

