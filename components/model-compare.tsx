"use client"

import { useState, useRef } from "react"
import { XIcon, SendIcon, LoadingIcon, BotIcon } from "@/components/icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock } from "@/components/code-block"

type Provider = "gemini" | "openai" | "xai"

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Gemini 2.5 Flash",
  openai: "GPT-4o",
  xai: "Grok 3 Fast",
}

const PROVIDER_ENDPOINTS: Record<Provider, string> = {
  gemini: "/api/chat",
  openai: "/api/chat/openai",
  xai: "/api/chat/xai",
}

export function ModelCompare({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [leftProvider, setLeftProvider] = useState<Provider>("gemini")
  const [rightProvider, setRightProvider] = useState<Provider>("xai")
  const [prompt, setPrompt] = useState("")
  const [leftResponse, setLeftResponse] = useState("")
  const [rightResponse, setRightResponse] = useState("")
  const [leftLoading, setLeftLoading] = useState(false)
  const [rightLoading, setRightLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const streamResponse = async (
    provider: Provider,
    message: string,
    setResponse: (updater: (prev: string) => string) => void,
    setLoading: (v: boolean) => void
  ) => {
    setLoading(true)
    setResponse(() => "")
    try {
      const res = await fetch(PROVIDER_ENDPOINTS[provider], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: [], files: [] }),
      })
      if (!res.ok) throw new Error(`${PROVIDER_LABELS[provider]} failed`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")
      const decoder = new TextDecoder()
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
              setResponse((prev) => prev + parsed.text)
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setResponse(() => `Error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCompare = () => {
    if (!prompt.trim()) return
    setError(null)
    if (leftProvider === rightProvider) {
      setError("Select different models to compare.")
      return
    }
    streamResponse(leftProvider, prompt, setLeftResponse, setLeftLoading)
    streamResponse(rightProvider, prompt, setRightResponse, setRightLoading)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Model Comparison</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close comparison"
        >
          <XIcon />
        </button>
      </div>

      {/* Prompt input */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <select
              value={leftProvider}
              onChange={(e) => setLeftProvider(e.target.value as Provider)}
              className="bg-muted border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="xai">Grok</option>
            </select>
            <span className="text-muted-foreground text-xs">vs</span>
            <select
              value={rightProvider}
              onChange={(e) => setRightProvider(e.target.value as Provider)}
              className="bg-muted border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="xai">Grok</option>
            </select>
          </div>
        </div>
        {error && <p className="text-destructive text-xs mb-2">{error}</p>}
        <div className="flex items-end gap-2 bg-muted/50 rounded-xl p-2 border border-border focus-within:border-primary transition-colors">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleCompare()
              }
            }}
            placeholder="Enter a prompt to compare models..."
            className="flex-1 bg-transparent focus:outline-none resize-none p-2 placeholder-muted-foreground max-h-24 text-foreground text-sm"
            rows={1}
            disabled={leftLoading || rightLoading}
          />
          <button
            onClick={handleCompare}
            disabled={!prompt.trim() || leftLoading || rightLoading}
            className="p-2 rounded-lg text-primary hover:bg-primary/20 disabled:text-muted-foreground disabled:hover:bg-transparent transition-colors"
            aria-label="Compare"
          >
            {leftLoading || rightLoading ? <LoadingIcon /> : <SendIcon />}
          </button>
        </div>
      </div>

      {/* Results side by side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left model */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <BotIcon />
              <span className="text-sm font-medium text-foreground">{PROVIDER_LABELS[leftProvider]}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {leftLoading && !leftResponse && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                {PROVIDER_LABELS[leftProvider]} is thinking...
              </div>
            )}
            {leftResponse && (
              <article className="markdown-content text-sm">
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
                >{leftResponse}</ReactMarkdown>
                {leftLoading && <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />}
              </article>
            )}
          </div>
        </div>

        {/* Right model */}
        <div className="flex-1 flex flex-col">
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <BotIcon />
              <span className="text-sm font-medium text-foreground">{PROVIDER_LABELS[rightProvider]}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {rightLoading && !rightResponse && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                {PROVIDER_LABELS[rightProvider]} is thinking...
              </div>
            )}
            {rightResponse && (
              <article className="markdown-content text-sm">
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
                >{rightResponse}</ReactMarkdown>
                {rightLoading && <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />}
              </article>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
