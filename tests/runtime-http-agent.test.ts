import assert from 'node:assert/strict'
import test from 'node:test'
import type { RunAgentParameters } from '@ag-ui/client'
import {
  AGENT_RUN_CONFLICT_MESSAGE,
  AGENT_RUN_INCOMPLETE_MESSAGE,
  RuntimeHttpAgent,
  TASK_DELTA_UNKNOWN_RESULT_MESSAGE,
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

test('forwards one queued task delta with the current user message id', async () => {
  const bodies: unknown[] = []
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      return sseResponse(
        { type: 'RUN_STARTED', threadId: 'conversation-1', runId: 'run-1' },
        { type: 'RUN_FINISHED', threadId: 'conversation-1', runId: 'run-1' }
      )
    },
  })
  assert.equal(agent.queueTaskDelta({
    schemaVersion: 1,
    operation: 'SELECT_CANDIDATE',
    taskId: 'task-1',
    expectedVersion: 4,
    questionId: 'question-1',
    optionId: 'hours',
  }), true)

  await agent.runAgent({
    ...input,
    messages: [{ id: 'message-2', role: 'user', content: '工时明细' }],
  })
  await agent.runAgent(input)

  assert.deepEqual((bodies[0] as { forwardedProps: { oaTaskDelta: unknown } }).forwardedProps.oaTaskDelta, {
    schemaVersion: 1,
    operation: 'SELECT_CANDIDATE',
    taskId: 'task-1',
    expectedVersion: 4,
    questionId: 'question-1',
    optionId: 'hours',
    sourceMessageId: 'message-2',
  })
  assert.equal('oaTaskDelta' in (bodies[1] as { forwardedProps: object }).forwardedProps, false)
  assert.equal(agent.taskDeltaStore.getSnapshot().status, 'ACKNOWLEDGED')
})

test('retries a failed task delta only with the same source message id', async () => {
  const bodies: Array<{ forwardedProps: Record<string, unknown> }> = []
  let attempts = 0
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      attempts += 1
      if (attempts === 1) return new Response('', { status: 503 })
      return sseResponse(
        { type: 'RUN_STARTED', threadId: 'conversation-1', runId: 'run-1' },
        { type: 'RUN_FINISHED', threadId: 'conversation-1', runId: 'run-1' }
      )
    },
  })
  agent.queueTaskDelta({ schemaVersion: 1, operation: 'REPLACE_SLOT', taskId: 'task-1', expectedVersion: 2, slotName: 'projectName', newValue: '项目甲' })
  const sameMessage = { ...input, messages: [{ id: 'message-retry', role: 'user', content: '修改项目' }] }

  await assert.rejects(agent.runAgent(sameMessage))
  await agent.runAgent({ ...input, messages: [{ id: 'different-message', role: 'user', content: '新问题' }] })
  await agent.runAgent(sameMessage)

  assert.ok(bodies[0]?.forwardedProps.oaTaskDelta)
  assert.equal(bodies[1]?.forwardedProps.oaTaskDelta, undefined)
  assert.ok(bodies[2]?.forwardedProps.oaTaskDelta)
})

test('retries an unknown task delta result only with its fixed source message id', async () => {
  const bodies: Array<{ forwardedProps: Record<string, unknown> }> = []
  let attempts = 0
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      attempts += 1
      if (attempts === 1) throw new TypeError('network reset')
      return sseResponse(
        { type: 'RUN_STARTED', threadId: 'conversation-1', runId: 'run-1' },
        { type: 'RUN_FINISHED', threadId: 'conversation-1', runId: 'run-1' }
      )
    },
  })
  agent.queueTaskDelta({
    schemaVersion: 1,
    operation: 'REPLACE_SLOT',
    taskId: 'task-1',
    expectedVersion: 2,
    slotName: 'projectName',
    newValue: '项目甲',
  })
  const original = {
    ...input,
    messages: [{ id: 'message-fixed', role: 'user', content: '修改项目' }],
  }

  await assert.rejects(
    agent.runAgent(original),
    (error: unknown) =>
      error instanceof Error && error.message === TASK_DELTA_UNKNOWN_RESULT_MESSAGE
  )
  assert.equal(agent.taskDeltaStore.getSnapshot().status, 'RETRYABLE_UNKNOWN')
  assert.equal(agent.retryTaskDelta(), true)
  await agent.runAgent({
    ...input,
    messages: [{ id: 'message-new', role: 'user', content: '新问题' }],
  })
  await agent.runAgent(original)

  assert.ok(bodies[0]?.forwardedProps.oaTaskDelta)
  assert.equal(bodies[1]?.forwardedProps.oaTaskDelta, undefined)
  assert.deepEqual(
    bodies[2]?.forwardedProps.oaTaskDelta,
    bodies[0]?.forwardedProps.oaTaskDelta
  )
  assert.equal(agent.taskDeltaStore.getSnapshot().status, 'ACKNOWLEDGED')
})

test('marks an aborted task delta as an unknown result', async () => {
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
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true }
        )
      })
    },
  })
  agent.queueTaskDelta({
    schemaVersion: 1,
    operation: 'CLEAR_SLOT',
    taskId: 'task-1',
    expectedVersion: 2,
    slotName: 'projectName',
  })
  const controller = new AbortController()
  const run = agent.runAgent(
    {
      ...input,
      messages: [{ id: 'message-abort', role: 'user', content: '清除项目' }],
    },
    undefined,
    { signal: controller.signal }
  )

  await started
  controller.abort()
  await run.catch(() => undefined)

  assert.equal(requestSignal?.aborted, true)
  assert.equal(agent.taskDeltaStore.getSnapshot().status, 'RETRYABLE_UNKNOWN')
  assert.equal(
    agent.taskDeltaStore.getSnapshot().failureKind,
    'unknown_result'
  )
})

test('requires authoritative rebase after a task delta conflict', async () => {
  const bodies: Array<{ forwardedProps: Record<string, unknown> }> = []
  let attempts = 0
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)))
      attempts += 1
      if (attempts === 1) return new Response('', { status: 409 })
      return sseResponse(
        { type: 'RUN_STARTED', threadId: 'conversation-1', runId: 'run-2' },
        { type: 'RUN_FINISHED', threadId: 'conversation-1', runId: 'run-2' }
      )
    },
  })
  agent.queueTaskDelta({
    schemaVersion: 1,
    operation: 'REPLACE_SLOT',
    taskId: 'task-1',
    expectedVersion: 2,
    slotName: 'projectName',
    newValue: '项目乙',
  })

  await assert.rejects(
    agent.runAgent({
      ...input,
      messages: [{ id: 'message-conflict', role: 'user', content: '修改项目' }],
    })
  )
  assert.deepEqual(
    {
      status: agent.taskDeltaStore.getSnapshot().status,
      refresh: agent.taskDeltaStore.getSnapshot().authoritativeRefreshRequired,
    },
    { status: 'CONFLICTED', refresh: true }
  )
  assert.equal(agent.retryTaskDelta(), false)
  assert.equal(agent.rebaseTaskDelta(5), true)
  await agent.runAgent({
    ...input,
    runId: 'run-2',
    messages: [{ id: 'message-rebased', role: 'user', content: '按最新状态修改项目' }],
  })

  assert.deepEqual(bodies[1]?.forwardedProps.oaTaskDelta, {
    schemaVersion: 1,
    operation: 'REPLACE_SLOT',
    taskId: 'task-1',
    expectedVersion: 5,
    slotName: 'projectName',
    newValue: '项目乙',
    sourceMessageId: 'message-rebased',
  })
})

test('discard releases a failed delta and duplicate queueing never creates two deltas', () => {
  const agent = new RuntimeHttpAgent({
    url: 'http://agent.test/api/agent/ag-ui',
    fetch: async () => new Response('', { status: 503 }),
  })
  const first = {
    schemaVersion: 1 as const,
    operation: 'CLEAR_SLOT' as const,
    taskId: 'task-1',
    expectedVersion: 2,
    slotName: 'projectName',
  }
  assert.equal(agent.queueTaskDelta(first), true)
  assert.equal(agent.queueTaskDelta(first), false)
  assert.equal(agent.discardTaskDelta(), true)
  assert.equal(agent.taskDeltaStore.getSnapshot().status, 'DISCARDED')
  assert.equal(
    agent.queueTaskDelta({ ...first, taskId: 'task-2', expectedVersion: 0 }),
    true
  )
})

function sseResponse(...events: object[]) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}
