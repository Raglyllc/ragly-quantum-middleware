"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import type { ChatMessage } from "@/lib/types"
import { BotIcon, UserIcon, SendIcon, LoadingIcon } from "@/components/icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface GeminiHistoryItem {
  role: "user" | "model"
  parts: { text: string }[]
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<GeminiHistoryItem[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto"
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }
    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsLoading(true)
    setError(null)

    const modelMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: modelMessageId, role: "model", content: "", isStreaming: true }])

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: currentInput, history }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send message")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let fullResponse = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)
              fullResponse += parsed.text
              setMessages((prev) =>
                prev.map((msg) => (msg.id === modelMessageId ? { ...msg, content: fullResponse } : msg))
              )
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      setMessages((prev) => prev.map((msg) => (msg.id === modelMessageId ? { ...msg, isStreaming: false } : msg)))

      // Update history for context
      setHistory((prev) => [
        ...prev,
        { role: "user", parts: [{ text: currentInput }] },
        { role: "model", parts: [{ text: fullResponse }] },
      ])
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred."
      setError(`Error: ${errorMessage}`)
      setMessages((prev) => prev.filter((msg) => msg.id !== modelMessageId))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-gray-200">
      <header className="p-4 border-b border-gray-800 shadow-lg bg-[#101018]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-cyan-400">RAGLY</h1>
          <p className="text-sm text-gray-400">Quantum Intelligence Middleware</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto chat-message-container">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
          {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-4 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "model" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <BotIcon />
                </div>
              )}
              <div
                className={`max-w-2xl rounded-xl px-5 py-3 shadow-md ${message.role === "user" ? "bg-purple-900/50 text-gray-100" : "bg-gray-800/70 text-gray-300"}`}
              >
                <article className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  {message.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse" />}
                </article>
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <UserIcon />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="p-4 border-t border-gray-800 bg-[#101018]/80 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-4xl mx-auto">
          {error && <p className="text-red-500 text-center mb-2 text-sm">{error}</p>}
          <form
            onSubmit={handleSendMessage}
            className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-2 border border-gray-700 focus-within:border-cyan-400 transition-colors"
          >
            <textarea
              ref={textAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e as unknown as React.FormEvent)
                }
              }}
              placeholder="Interact with RAGLY..."
              className="flex-1 bg-transparent focus:outline-none resize-none p-2 placeholder-gray-500 max-h-40"
              rows={1}
              disabled={isLoading}
              aria-label="Chat input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 mt-1 rounded-lg text-cyan-400 hover:bg-cyan-400/20 disabled:text-gray-600 disabled:hover:bg-transparent transition-colors"
              aria-label="Send message"
            >
              {isLoading ? <LoadingIcon /> : <SendIcon />}
            </button>
          </form>
        </div>
      </footer>
    </div>
  )
}
