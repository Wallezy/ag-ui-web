import assert from 'node:assert/strict'
import test from 'node:test'
import type { RunAgentParameters } from '@ag-ui/client'
import {
  AGENT_RUN_CONFLICT_MESSAGE,
  RuntimeHttpAgent,
} from '../src/features/agents/runtime-http-agent.ts'

const input: RunAgentParameters = {
  threadId: 'conversation-1',
  runId: 'run-1',
  messages: [],
  tools: [],
  context: [],
  state: {},
  forwardedProps: {},
}

test('forwards the assistant runtime cancellation signal to the HTTP request', async () => {
  let requestSignal: AbortSignal | null = null
  let notifyStarted!: () => void
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve
  })
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async (_url, init) => {
      requestSignal = init?.signal ?? null
      notifyStarted()
      return await new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted', 'AbortError')),
          { once: true }
        )
      })
    },
  })
  const runtimeController = new AbortController()

  const run = agent.runAgent(input, undefined, {
    signal: runtimeController.signal,
  })
  await started
  runtimeController.abort()
  await run

  assert.equal(requestSignal?.aborted, true)
})

test('replaces a persistent HTTP 409 with a user-facing conflict message', async () => {
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async () => new Response('', { status: 409 }),
  })

  await assert.rejects(
    agent.runAgent(input),
    (error: unknown) =>
      error instanceof Error && error.message === AGENT_RUN_CONFLICT_MESSAGE
  )
})
