import { createFileRoute } from '@tanstack/react-router'
import { AgentWorkspace } from '@/features/agents'

export const Route = createFileRoute('/_authenticated/agents/weather')({
  component: WeatherAgentRoute,
})

function WeatherAgentRoute() {
  return <AgentWorkspace initialAgentId='weatherAgent' />
}
