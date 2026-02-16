"use client"

import { useState, useEffect } from "react"
import { XIcon, TrashIcon } from "@/components/icons"
import type { ChatMessage } from "@/lib/types"

export interface SavedConversation {
  id: string
  title: string
  provider: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

function getConversations(): SavedConversation[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem("ragly-conversations")
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveConversations(conversations: SavedConversation[]) {
  localStorage.setItem("ragly-conversations", JSON.stringify(conversations))
}

export function saveCurrentConversation(messages: ChatMessage[], provider: string) {
  if (messages.length === 0) return
  const conversations = getConversations()
  const title = messages[0]?.content.slice(0, 60) || "Untitled"
  const existing = conversations.find(
    (c) => c.messages[0]?.content === messages[0]?.content && c.provider === provider
  )
  if (existing) {
    existing.messages = messages
    existing.updatedAt = new Date().toISOString()
  } else {
    conversations.unshift({
      id: Date.now().toString(),
      title,
      provider,
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  // Keep max 50 conversations
  saveConversations(conversations.slice(0, 50))
}

export function ConversationHistory({
  isOpen,
  onClose,
  onLoad,
}: {
  isOpen: boolean
  onClose: () => void
  onLoad: (messages: ChatMessage[], provider: string) => void
}) {
  const [conversations, setConversations] = useState<SavedConversation[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (isOpen) setConversations(getConversations())
  }, [isOpen])

  const handleDelete = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id)
    setConversations(updated)
    saveConversations(updated)
  }

  const handleClearAll = () => {
    setConversations([])
    saveConversations([])
  }

  const filtered = search
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
      )
    : conversations

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 left-0 w-full sm:w-[360px] bg-card border-r border-border shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Chat History</h2>
        <div className="flex items-center gap-2">
          {conversations.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close history"
          >
            <XIcon />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {search ? "No matching conversations." : "No saved conversations yet."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((conv) => (
              <div
                key={conv.id}
                className="p-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => {
                  onLoad(conv.messages, conv.provider)
                  onClose()
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onLoad(conv.messages, conv.provider)
                    onClose()
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {conv.provider === "xai" ? "Grok" : conv.provider === "openai" ? "OpenAI" : "Gemini"}
                      </span>
                      <span className="text-xs text-muted-foreground">{conv.messages.length} messages</span>
                      <span className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(conv.id)
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Delete conversation"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
