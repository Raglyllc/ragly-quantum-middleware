"use client"

import { XIcon } from "@/components/icons"

const shortcuts = [
  { keys: ["Cmd", "K"], description: "New chat" },
  { keys: ["Cmd", "/"], description: "Switch AI provider" },
  { keys: ["Cmd", "D"], description: "Toggle theme" },
  { keys: ["Cmd", "H"], description: "Toggle chat history" },
  { keys: ["Cmd", "J"], description: "Toggle X panel" },
  { keys: ["Cmd", "M"], description: "Model comparison" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line" },
]

export function ShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.description} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">Use Ctrl instead of Cmd on Windows/Linux</p>
        </div>
      </div>
    </div>
  )
}
