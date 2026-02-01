"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import type { ChatMessage } from "@/lib/types"
import { BotIcon, UserIcon, SendIcon, LoadingIcon, PaperclipIcon, XIcon, FileIcon } from "@/components/icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface GeminiHistoryItem {
  role: "user" | "model"
  parts: { text: string }[]
}

interface UploadedFile {
  name: string
  type: string
  size: number
  base64: string
  preview?: string
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<GeminiHistoryItem[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto"
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newFiles: UploadedFile[] = []
    for (const file of Array.from(files)) {
      const base64 = await fileToBase64(file)
      const uploadedFile: UploadedFile = {
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }
      newFiles.push(uploadedFile)
    }
    setUploadedFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(",")[1]
        resolve(base64)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return

    const fileNames = uploadedFiles.map((f) => f.name).join(", ")
    const displayContent = uploadedFiles.length > 0 ? `${input}${input ? "\n" : ""}[Attached: ${fileNames}]` : input

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: displayContent,
    }
    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    const currentFiles = [...uploadedFiles]
    setInput("")
    setUploadedFiles([])
    setIsLoading(true)
    setError(null)

    const modelMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: modelMessageId, role: "model", content: "", isStreaming: true }])

    try {
      const filesToSend = currentFiles.map((f) => ({
        name: f.name,
        type: f.type,
        base64: f.base64,
      }))

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: currentInput, history, files: filesToSend }),
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
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border shadow-lg bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Image src="/logo.png" alt="RAGLY Logo" width={140} height={48} className="h-10 w-auto" priority />
          <p className="text-sm text-muted-foreground hidden sm:block">Quantum Intelligence Middleware</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto chat-message-container">
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
          {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-4 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "model" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <BotIcon />
                </div>
              )}
              <div
                className={`max-w-2xl rounded-xl px-5 py-3 shadow-md ${message.role === "user" ? "bg-secondary/50 text-secondary-foreground" : "bg-muted text-card-foreground"}`}
              >
                <article className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  {message.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />}
                </article>
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <UserIcon />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="p-4 border-t border-border bg-card/80 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-4xl mx-auto">
          {error && <p className="text-destructive text-center mb-2 text-sm">{error}</p>}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {uploadedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border"
                >
                  {file.preview ? (
                    <Image
                      src={file.preview || "/placeholder.svg"}
                      alt={file.name}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <FileIcon />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground truncate max-w-32">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-muted/50 rounded-xl p-2 border border-border focus-within:border-primary transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.csv"
              className="hidden"
              aria-label="Upload files"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/20 transition-colors"
              aria-label="Attach files"
              disabled={isLoading}
            >
              <PaperclipIcon />
            </button>
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
              className="flex-1 bg-transparent focus:outline-none resize-none p-2 placeholder-muted-foreground max-h-40 text-foreground"
              rows={1}
              disabled={isLoading}
              aria-label="Chat input"
            />
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
              className="p-2 rounded-lg text-primary hover:bg-primary/20 disabled:text-muted-foreground disabled:hover:bg-transparent transition-colors"
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
