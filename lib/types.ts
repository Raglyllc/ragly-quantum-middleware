export interface ChatMessage {
  id: string
  role: "user" | "model"
  content: string
  isStreaming?: boolean
}
