"use client"

import { useState } from "react"
import { CopyIcon, CheckSmallIcon } from "@/components/icons"

export function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false)

  const getTextContent = (node: React.ReactNode): string => {
    if (typeof node === "string") return node
    if (typeof node === "number") return String(node)
    if (!node) return ""
    if (Array.isArray(node)) return node.map(getTextContent).join("")
    if (typeof node === "object" && "props" in node) {
      return getTextContent((node as React.ReactElement).props.children)
    }
    return ""
  }

  const handleCopy = async () => {
    const text = getTextContent(children)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const language = className?.replace("language-", "") || ""

  return (
    <div className="relative group">
      {language && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-border/30 rounded-t-lg border border-b-0 border-border">
          <span className="text-xs text-muted-foreground font-mono">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className={`bg-card border border-border p-4 overflow-x-auto ${language ? "rounded-b-lg rounded-t-none" : "rounded-lg"}`}>
          <code className={className}>{children}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 border border-border text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Copy code"
        >
          {copied ? <CheckSmallIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  )
}
