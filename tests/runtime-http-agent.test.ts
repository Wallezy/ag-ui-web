import assert from 'node:assert/strict'
import test from 'node:test'
import type { RunAgentParameters } from '@ag-ui/client'
import {
  AGENT_RUN_CONFLICT_MESSAGE,
  AGENT_RUN_INCOMPLETE_MESSAGE,
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

test('reports a failed response step when the HTTP stream ends without a terminal event', async () => {
  const progress: string[] = []
  const failures: Error[] = []
  let finalized = 0
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async () => sseResponse({ type: 'RUN_STARTED', threadId: 'conversation-1', runId: 'run-1' }),
  })

  await agent.runAgent(input, {
    onReasoningMessageContentEvent: ({ event }) => {
      progress.push(event.delta)
    },
    onRunFailed: ({ error }) => {
      failures.push(error)
    },
    onRunFinalized: () => {
      finalized += 1
    },
  })

  assert.equal(finalized, 0)
  assert.equal(failures.length, 1)
  assert.equal(failures[0]?.message, AGENT_RUN_INCOMPLETE_MESSAGE)
  assert.equal(progress.length, 1)
  assert.deepEqual(JSON.parse(progress[0] ?? ''), {
    kind: 'execution_progress',
    stepId: 'response',
    phase: 'response',
    status: 'failed',
    title: '连接已中断',
    detail: '未收到完整的运行结果，请重试',
    sequence: 2_147_483_647,
  })
})

test('preserves normal finalization when the stream includes RUN_FINISHED', async () => {
  let finished = 0
  let finalized = 0
  let failed = 0
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async () =>
      sseResponse(
        { type: 'RUN_STARTED', threadId: 'conversation-1', runId: 'run-1' },
        { type: 'RUN_FINISHED', threadId: 'conversation-1', runId: 'run-1' }
      ),
  })

  await agent.runAgent(input, {
    onRunFinishedEvent: () => {
      finished += 1
    },
    onRunFailed: () => {
      failed += 1
    },
    onRunFinalized: () => {
      finalized += 1
    },
  })

  assert.equal(finished, 1)
  assert.equal(finalized, 1)
  assert.equal(failed, 0)
})

test('bridges an explicit RUN_ERROR to subscribers without a run-error handler', async () => {
  const failures: Error[] = []
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async () =>
      sseResponse(
        { type: 'RUN_STARTED', threadId: 'conversation-1', runId: 'run-1' },
        {
          type: 'RUN_ERROR',
          threadId: 'conversation-1',
          runId: 'run-1',
          message: '智能体运行已中断，请重试。',
          code: 'AGENT_RUN_CANCELLED',
        }
      ),
  })

  await agent.runAgent(input, {
    onRunFailed: ({ error }) => {
      failures.push(error)
    },
  })

  assert.equal(failures.length, 1)
  assert.equal(failures[0]?.message, '智能体运行已中断，请重试。')
  assert.equal(
    (failures[0] as Error & { code?: string } | undefined)?.code,
    'AGENT_RUN_CANCELLED'
  )
})

function sseResponse(...events: object[]) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}
