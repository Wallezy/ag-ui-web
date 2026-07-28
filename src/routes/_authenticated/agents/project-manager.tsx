import { createFileRoute } from '@tanstack/react-router'
import { AgentWorkspace } from '@/features/agents'

export const Route = createFileRoute('/_authenticated/agents/project-manager')({
  component: ProjectManagerAgentRoute,
})

function ProjectManagerAgentRoute() {
  return <AgentWorkspace initialAgentId='projectManagerAgent' />
}
