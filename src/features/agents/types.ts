export type AgentId = 'weatherAgent' | 'projectManagerAgent'

export type ConversationSummary = {
  id: string
  title: string
  lastMessage: string
  updatedAt: string
  agentId: AgentId
  status?: string
}
