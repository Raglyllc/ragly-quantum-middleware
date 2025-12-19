"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { streamMessage, getChatSession } from "@/lib/gemini-service"
import type { ChatMessage } from "@/lib/types"
import { BotIcon, UserIcon, SendIcon, LoadingIcon } from "@/components/icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    console.log("[v0] Initializing RAGLY...")
    console.log("[v0] API Key exists:", !!process.env.NEXT_PUBLIC_GEMINI_API_KEY)

    try {
      getChatSession()
      console.log("[v0] Chat session initialized successfully")
      setIsInitialized(true)
      setError(null)
    } catch (e) {
      console.error("[v0] Initialization error:", e)
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during initialization."
      setError(errorMessage)
      setIsInitialized(false)
    }
  }, [])

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

    if (!isInitialized) {
      setError("Chat session not initialized. Please check your API key.")
      return
    }

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
      console.log("[v0] Sending message:", currentInput)
      const stream = await streamMessage(currentInput)
      let fullResponse = ""
      for await (const chunk of stream) {
        fullResponse += chunk.text
        setMessages((prev) => prev.map((msg) => (msg.id === modelMessageId ? { ...msg, content: fullResponse } : msg)))
      }
      setMessages((prev) => prev.map((msg) => (msg.id === modelMessageId ? { ...msg, isStreaming: false } : msg)))
      console.log("[v0] Message completed")
    } catch (e) {
      console.error("[v0] Message error:", e)
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
                  handleSendMessage(e as any)
                }
              }}
              placeholder="Interact with RAGLY..."
              className="flex-1 bg-transparent focus:outline-none resize-none p-2 placeholder-gray-500 max-h-40"
              rows={1}
              disabled={isLoading || !isInitialized}
              aria-label="Chat input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !isInitialized}
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
