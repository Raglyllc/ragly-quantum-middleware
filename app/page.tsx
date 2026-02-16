"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import type { ChatMessage } from "@/lib/types"
import {
  BotIcon, UserIcon, SendIcon, LoadingIcon, PaperclipIcon,
  XIcon, FileIcon, TwitterIcon, RegenerateIcon, SunIcon,
  MoonIcon, HistoryIcon, CompareIcon, KeyboardIcon,
} from "@/components/icons"
import { XPanel } from "@/components/x-panel"
import { XEmbed } from "@/components/x-embed"
import { ConversationHistory, saveCurrentConversation } from "@/components/conversation-history"
import { ModelCompare } from "@/components/model-compare"
import { ShortcutsModal } from "@/components/shortcuts-modal"
import { CodeBlock } from "@/components/code-block"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useSwipe } from "@/hooks/use-swipe"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface GeminiHistoryItem {
  role: "user" | "model"
  parts: { text: string }[]
}

interface OpenAIHistoryItem {
  role: "user" | "assistant"
  content: string
}

interface UploadedFile {
  name: string
  type: string
  size: number
  base64: string
  preview?: string
}

type AIProvider = "gemini" | "openai" | "xai"

const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: "Gemini 2.5 Flash",
  openai: "GPT-4o",
  xai: "Grok 3 Fast",
}

const PROVIDERS: AIProvider[] = ["gemini", "openai", "xai"]

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [geminiHistory, setGeminiHistory] = useState<GeminiHistoryItem[]>([])
  const [openaiHistory, setOpenaiHistory] = useState<OpenAIHistoryItem[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [provider, setProvider] = useState<AIProvider>("gemini")
  const [isXPanelOpen, setIsXPanelOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Swipe gestures for mobile
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      if (!isXPanelOpen && !isHistoryOpen) setIsXPanelOpen(true)
      if (isHistoryOpen) setIsHistoryOpen(false)
    },
    onSwipeRight: () => {
      if (isXPanelOpen) setIsXPanelOpen(false)
      if (!isHistoryOpen && !isXPanelOpen) setIsHistoryOpen(true)
    },
  })

  // Apply theme class to html element
  useEffect(() => {
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  const clearChat = useCallback(() => {
    // Save before clearing
    if (messages.length > 0) {
      saveCurrentConversation(messages, provider)
    }
    setMessages([])
    setGeminiHistory([])
    setOpenaiHistory([])
    setError(null)
  }, [messages, provider])

  const switchProvider = useCallback(() => {
    const idx = PROVIDERS.indexOf(provider)
    setProvider(PROVIDERS[(idx + 1) % PROVIDERS.length])
  }, [provider])

  useKeyboardShortcuts({
    onNewChat: clearChat,
    onSwitchProvider: switchProvider,
    onToggleXPanel: () => setIsXPanelOpen((p) => !p),
    onToggleTheme: toggleTheme,
    onToggleHistory: () => setIsHistoryOpen((p) => !p),
    onToggleCompare: () => setIsCompareOpen((p) => !p),
  })

  // Auto-save conversation when messages change
  useEffect(() => {
    if (messages.length > 1) {
      const timeout = setTimeout(() => saveCurrentConversation(messages, provider), 2000)
      return () => clearTimeout(timeout)
    }
  }, [messages, provider])

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
      newFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })
    }
    setUploadedFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve((reader.result as string).split(",")[1])
      reader.onerror = reject
    })

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => {
      const newFiles = [...prev]
      if (newFiles[index].preview) URL.revokeObjectURL(newFiles[index].preview!)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const sendMessage = async (messageText: string, files: UploadedFile[], targetProvider: AIProvider) => {
    const fileNames = files.map((f) => f.name).join(", ")
    const displayContent = files.length > 0 ? `${messageText}${messageText ? "\n" : ""}[Attached: ${fileNames}]` : messageText

    const userMessage: ChatMessage = { id: Date.now().toString(), role: "user", content: displayContent }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    const modelMessageId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: modelMessageId, role: "model", content: "", isStreaming: true }])

    try {
      const filesToSend = files.map((f) => ({ name: f.name, type: f.type, base64: f.base64 }))
      const apiEndpoint =
        targetProvider === "openai" ? "/api/chat/openai" : targetProvider === "xai" ? "/api/chat/xai" : "/api/chat"
      const historyToSend = targetProvider === "gemini" ? geminiHistory : openaiHistory

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, history: historyToSend, files: filesToSend }),
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
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data)
              fullResponse += parsed.text
              setMessages((prev) =>
                prev.map((msg) => (msg.id === modelMessageId ? { ...msg, content: fullResponse } : msg))
              )
            } catch { /* skip */ }
          }
        }
      }

      setMessages((prev) => prev.map((msg) => (msg.id === modelMessageId ? { ...msg, isStreaming: false } : msg)))

      if (targetProvider === "openai" || targetProvider === "xai") {
        setOpenaiHistory((prev) => [
          ...prev,
          { role: "user", content: messageText },
          { role: "assistant", content: fullResponse },
        ])
      } else {
        setGeminiHistory((prev) => [
          ...prev,
          { role: "user", parts: [{ text: messageText }] },
          { role: "model", parts: [{ text: fullResponse }] },
        ])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred."
      setError(`Error: ${errorMessage}`)
      setMessages((prev) => prev.filter((msg) => msg.id !== modelMessageId))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return
    const currentInput = input
    const currentFiles = [...uploadedFiles]
    setInput("")
    setUploadedFiles([])
    await sendMessage(currentInput, currentFiles, provider)
  }

  const handleRegenerate = async () => {
    if (isLoading || messages.length < 2) return
    // Find the last user message
    const lastUserMsgIndex = [...messages].reverse().findIndex((m) => m.role === "user")
    if (lastUserMsgIndex === -1) return
    const actualIndex = messages.length - 1 - lastUserMsgIndex
    const lastUserMsg = messages[actualIndex]

    // Remove the last model response
    setMessages((prev) => prev.slice(0, actualIndex))

    // Trim history
    if (provider === "gemini") {
      setGeminiHistory((prev) => prev.slice(0, -2))
    } else {
      setOpenaiHistory((prev) => prev.slice(0, -2))
    }

    // Clean the display content for re-sending
    const cleanContent = lastUserMsg.content.replace(/\n?\[Attached:.*\]$/, "")
    await sendMessage(cleanContent, [], provider)
  }

  const handleLoadConversation = (loadedMessages: ChatMessage[], loadedProvider: string) => {
    setMessages(loadedMessages)
    setProvider(loadedProvider as AIProvider)
    setGeminiHistory([])
    setOpenaiHistory([])
    setError(null)
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-3 md:p-4 border-b border-border shadow-lg bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="RAGLY Logo" width={140} height={48} className="h-8 md:h-10 w-auto" priority />
            <p className="text-sm text-muted-foreground hidden lg:block">Quantum Intelligence Middleware</p>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* History */}
            <button
              type="button"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className={`p-2 rounded-lg border transition-colors ${
                isHistoryOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary"
              }`}
              aria-label="Chat history (Cmd+H)"
              title="Chat history (Cmd+H)"
            >
              <HistoryIcon />
            </button>
            {/* Compare */}
            <button
              type="button"
              onClick={() => setIsCompareOpen(!isCompareOpen)}
              className={`p-2 rounded-lg border transition-colors ${
                isCompareOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary"
              }`}
              aria-label="Compare models (Cmd+M)"
              title="Compare models (Cmd+M)"
            >
              <CompareIcon />
            </button>
            {/* X Panel */}
            <button
              type="button"
              onClick={() => setIsXPanelOpen(!isXPanelOpen)}
              className={`p-2 rounded-lg border transition-colors ${
                isXPanelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary"
              }`}
              aria-label="Toggle X panel (Cmd+J)"
              title="Toggle X panel (Cmd+J)"
            >
              <TwitterIcon />
            </button>
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              aria-label="Toggle theme (Cmd+D)"
              title="Toggle theme (Cmd+D)"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            {/* Provider select */}
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              className="bg-muted border border-border rounded-lg px-2 md:px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
              disabled={isLoading}
              aria-label="Select AI provider"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="xai">Grok</option>
            </select>
            {/* Shortcuts */}
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              className="p-2 rounded-lg border bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors hidden md:flex"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              <KeyboardIcon />
            </button>
            {/* Clear */}
            <button
              type="button"
              onClick={clearChat}
              className="px-2 md:px-3 py-1.5 text-sm bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              disabled={isLoading}
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto chat-message-container" {...swipeHandlers}>
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-8 py-4">
              {/* Welcome header */}
              <div className="text-center">
                <div className="w-16 h-16 mb-4 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <BotIcon />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2 text-balance">Welcome to RAGLY</h2>
                <p className="text-muted-foreground max-w-md mb-2">Topological Reasoning System Core Infrastructure</p>
                <p className="text-sm text-muted-foreground">
                  Powered by {PROVIDER_LABELS[provider]}. Start a conversation or attach files for analysis.
                </p>
                <div className="flex items-center justify-center gap-3 mt-4 text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">Cmd+K</kbd>
                  <span>New chat</span>
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">Cmd+/</kbd>
                  <span>Switch model</span>
                </div>
              </div>

              {/* Embedded X Profile & Timeline */}
              <div className="w-full max-w-lg">
                <div className="flex items-center gap-2 mb-3">
                  <TwitterIcon />
                  <h3 className="text-sm font-semibold text-foreground">@ahayahsharif Live Feed</h3>
                  <span className="text-xs text-muted-foreground">- Integrated Node</span>
                </div>
                <XEmbed
                  onDraftReply={(tweetText, author) => {
                    setInput(`Draft a reply to @${author}'s tweet: "${tweetText}"`)
                    textAreaRef.current?.focus()
                  }}
                />
              </div>
            </div>
          )}
          {messages.map((message, idx) => (
            <div key={message.id} className={`flex items-start gap-3 md:gap-4 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "model" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <BotIcon />
                </div>
              )}
              <div className={`max-w-2xl rounded-xl px-4 md:px-5 py-3 shadow-md ${
                message.role === "user"
                  ? "bg-secondary/50 text-secondary-foreground"
                  : "bg-muted text-card-foreground"
              }`}>
                {/* Typing indicator */}
                {message.role === "model" && message.isStreaming && !message.content && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span>{PROVIDER_LABELS[provider]} is thinking...</span>
                  </div>
                )}
                <article className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ children }) => <>{children}</>,
                      code: ({ className: cn, children, ...props }) => {
                        const isBlock = cn?.startsWith("language-")
                        if (isBlock) return <CodeBlock className={cn}>{children}</CodeBlock>
                        return <code className={cn} {...props}>{children}</code>
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {message.isStreaming && message.content && (
                    <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
                  )}
                </article>
                {/* Regenerate button on last model message */}
                {message.role === "model" && !message.isStreaming && idx === messages.length - 1 && messages.length > 1 && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                    <button
                      onClick={handleRegenerate}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                      aria-label="Regenerate response"
                    >
                      <RegenerateIcon /> Regenerate
                    </button>
                  </div>
                )}
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

      <footer className="p-3 md:p-4 border-t border-border bg-card/80 backdrop-blur-sm sticky bottom-0">
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

      {/* Overlays */}
      <XPanel
        isOpen={isXPanelOpen}
        onClose={() => setIsXPanelOpen(false)}
        onDraftReply={(tweetText, author) => {
          setInput(`Draft a reply to @${author}'s tweet: "${tweetText}"`)
          setIsXPanelOpen(false)
          textAreaRef.current?.focus()
        }}
      />
      <ConversationHistory isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onLoad={handleLoadConversation} />
      <ModelCompare isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  )
}
