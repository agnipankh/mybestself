import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    console.log("[openai-chat] Received messages:", messages)

    const openaiUrl = "https://api.openai.com/v1/chat/completions"
    const payload = {
      //model: "gpt-4o","gpt-4.1""GPT-4.1-mini"
      model: "gpt-4.1-mini",
      messages: messages.map((msg: any) => ({
        role: msg.from === "user" ? "user" : "assistant",
        content: msg.text,
      })),
    }
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    }
    
    console.log("[openai-chat] Making request to:", openaiUrl)
    console.log("[openai-chat] Headers:", headers)
    console.log("[openai-chat] Body:", JSON.stringify(payload, null, 2))



    const openaiRes = await fetch(openaiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    const data = await openaiRes.json()
    console.log("[openai-chat] OpenAI raw response:", data)

    if (!openaiRes.ok || !data.choices || !data.choices[0]?.message?.content) {
      console.warn("[openai-chat] OpenAI returned unexpected data:", data)
      return NextResponse.json(
        { error: data.error?.message || "OpenAI failed to return a message." },
        { status: 500 }
      )
    }

    return NextResponse.json({ reply: data.choices[0].message.content })
  } catch (err: any) {
    console.error("[openai-chat] Unexpected error:", err)
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 })
  }
}

