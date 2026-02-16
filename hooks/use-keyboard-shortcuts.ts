"use client"

import { useEffect } from "react"

interface ShortcutActions {
  onNewChat: () => void
  onSwitchProvider: () => void
  onToggleXPanel: () => void
  onToggleTheme: () => void
  onToggleHistory: () => void
  onToggleCompare: () => void
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === "k") {
        e.preventDefault()
        actions.onNewChat()
      }
      if (isMeta && e.key === "/") {
        e.preventDefault()
        actions.onSwitchProvider()
      }
      if (isMeta && e.key === "j") {
        e.preventDefault()
        actions.onToggleXPanel()
      }
      if (isMeta && e.key === "d") {
        e.preventDefault()
        actions.onToggleTheme()
      }
      if (isMeta && e.key === "h") {
        e.preventDefault()
        actions.onToggleHistory()
      }
      if (isMeta && e.key === "m") {
        e.preventDefault()
        actions.onToggleCompare()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [actions])
}
