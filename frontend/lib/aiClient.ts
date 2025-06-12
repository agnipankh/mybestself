// lib/aiClient.ts
import { ChatCompletionRequestMessage } from "openai"

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export async function getChatCompletion({
  model = "openai",
  messages,
}: {
  model: "openai" | "anthropic"
  messages: ChatMessage[]
}): Promise<string> {
  if (model === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages,
      }),
    })
    const json = await res.json()
    return json.choices?.[0]?.message?.content ?? "No response"
  }

  if (model === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229",
        messages,
        max_tokens: 1000,
      }),
    })
    const json = await res.json()
    return json.content?.[0]?.text ?? "No response"
  }

  return "Unsupported model"
}

