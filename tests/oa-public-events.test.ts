import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  AgentTaskViewStore,
  initialAgentTaskViewState,
  parseOaPublicAgentEvent,
  reduceAgentTaskViewState,
} from '../src/features/agents/oa-public-events.ts'

test('pins the shared v3 contract hashes', () => {
  assert.equal(
    sha256('contracts/oa-public-agent-event-v3.schema.json'),
    'c116296d2ee940c057daa8996aea95371a1fcd09779e4a17f386a1d93ae17517'
  )
  assert.equal(
    sha256('contracts/fixtures/oa-public-agent-event-v3.json'),
    'c06f0677e2e39e2fef397275d08f659a6e10e24a86f23d78213566951ea8f265'
  )
})

test('parses the v2 envelope and rejects unknown or unsafe input', () => {
  assert.equal(parseOaPublicAgentEvent(event('understanding'))?.schemaVersion, 2)
  assert.equal(
    parseOaPublicAgentEvent({ ...event('future'), schemaVersion: 4 }),
    null
  )
  assert.equal(
    parseOaPublicAgentEvent({
      ...event('unsafe'),
      payload: { reasonCode: 'OK', displayMessage: { raw: 'payload' } },
    }),
    null
  )
})

test('parses v3 typed slots and deduplicates its v2 projection', () => {
  const store = new AgentTaskViewStore()
  const v3 = event('dual', 2, 'OA_UNDERSTANDING_READY', {
    slots: [{
      name: 'assigneeName',
      label: '人员',
      valueSummary: '王翔',
      source: 'USER_CORRECTION',
      status: 'GROUNDED',
      critical: true,
      editable: true,
      conflictReason: '',
    }],
  }, 3)
  assert.equal(store.accept(v3), true)
  assert.equal(store.getSnapshot().understanding?.slots?.[0]?.valueSummary, '王翔')
  assert.equal(store.getSnapshot().traceId, 'trace-1')
  assert.equal(store.getSnapshot().schemaVersion, 3)
  assert.equal(store.accept(event('dual', 2)), false)
  assert.equal(store.getSnapshot().eventIds.size, 1)
})

test('parses bounded clarification metadata and rejects malformed options', () => {
  const clarification = parseOaPublicAgentEvent(event('question', 2, 'OA_CLARIFICATION_REQUIRED', {
    questionId: 'question-1',
    questionKind: 'SEMANTIC_CLARIFICATION',
    options: [{ optionId: 'hours', label: '工时明细' }],
    allowFreeText: true,
    expiresAt: '2026-07-25T12:05:00Z',
  }))
  assert.equal(clarification?.payload.options?.[0]?.optionId, 'hours')
  assert.equal(parseOaPublicAgentEvent(event('bad-question', 2, 'OA_CLARIFICATION_REQUIRED', {
    options: [{ optionId: 'hours', label: '工时', hidden: 'unsafe' }],
  })), null)
})

test('accepts a newer task version after waiting for clarification', () => {
  const waiting = reduceAgentTaskViewState(
    initialAgentTaskViewState,
    parseOaPublicAgentEvent(event('question', 1, 'OA_CLARIFICATION_REQUIRED', {
      questionId: 'question-1',
    }))!
  )
  const resumed = reduceAgentTaskViewState(
    waiting,
    parseOaPublicAgentEvent(event('resumed', 2, 'OA_TASK_STATE_UPDATED'))!
  )
  assert.equal(resumed.terminal, null)
  assert.equal(resumed.pending, null)
})

test('deduplicates replay and rejects stale task versions', () => {
  const first = parseOaPublicAgentEvent(event('same'))!
  const state = reduceAgentTaskViewState(initialAgentTaskViewState, first)

  assert.equal(reduceAgentTaskViewState(state, first), state)
  assert.equal(
    reduceAgentTaskViewState(
      state,
      parseOaPublicAgentEvent(event('stale', 0))!
    ),
    state
  )
})

test('rebuilds steps and repairs while guarding terminal state', () => {
  const store = new AgentTaskViewStore()
  store.accept(event('understanding'))
  store.accept(event('step', 1, 'OA_STEP_STARTED', { stepId: 'step-1' }))
  store.accept(
    event('repair', 1, 'OA_REPAIR_TRIGGERED', {
      stepId: 'step-1',
      action: 'REPAIR_ARGUMENTS',
    })
  )
  store.accept(
    event('verified', 1, 'OA_VERIFICATION_COMPLETED', {
      status: 'COMPLETE',
    })
  )
  const terminal = store.getSnapshot()

  assert.equal(terminal.repairs.length, 1)
  assert.equal(terminal.terminal, 'complete')
  assert.equal(store.accept(event('late-step', 1, 'OA_STEP_STARTED')), false)
  assert.equal(store.getSnapshot(), terminal)
})

test('rebuilds the same repair timeline from replayed reconnect events', () => {
  const frames = [
    event('understanding'),
    event('state', 1, 'OA_TASK_STATE_UPDATED'),
    event('plan', 1, 'OA_PLAN_CREATED'),
    event('step', 1, 'OA_STEP_STARTED', { stepId: 'step-1' }),
    event('observed', 1, 'OA_OBSERVATION_RECEIVED', { stepId: 'step-1' }),
    event('repair', 1, 'OA_REPAIR_TRIGGERED', { stepId: 'step-1', action: 'SAFE_PROBE' }),
  ]
  const first = new AgentTaskViewStore()
  const reconnected = new AgentTaskViewStore()
  frames.forEach((frame) => first.accept(frame))
  ;[...frames, frames[4]!, frames[5]!].forEach((frame) => reconnected.accept(frame))
  assert.deepEqual(reconnected.getSnapshot().repairs, first.getSnapshot().repairs)
})

test('clears the stale task projection when a new run starts', () => {
  const store = new AgentTaskViewStore()
  store.accept(event('old-understanding', 5, 'OA_UNDERSTANDING_READY', {
    selectedIntentId: 'WORK_HOUR_PREPARE',
  }))
  store.accept(event('old-complete', 5, 'OA_VERIFICATION_COMPLETED', {
    status: 'COMPLETE',
  }))

  assert.equal(store.beginRun('run-current'), true)
  assert.equal(store.getSnapshot().activeRunId, 'run-current')
  assert.equal(store.getSnapshot().understanding, null)
  assert.equal(store.getSnapshot().terminal, null)
})

test('ignores late events from an old run and accepts the same task version from the current run', () => {
  const store = new AgentTaskViewStore()
  store.beginRun('run-current')

  assert.equal(store.accept({ ...event('late', 5), runId: 'run-old' }), false)
  assert.equal(store.getSnapshot().understanding, null)
  assert.equal(store.accept({ ...event('current', 5), runId: 'run-current' }), true)
  assert.equal(store.getSnapshot().taskVersion, 5)
})

function event(
  eventId: string,
  taskVersion = 1,
  eventType = 'OA_UNDERSTANDING_READY',
  payload: Record<string, unknown> = {},
  schemaVersion: 2 | 3 = 2
) {
  return {
    schemaVersion,
    eventId,
    traceId: 'trace-1',
    ...(schemaVersion === 3 ? { runId: 'run-1' } : {}),
    taskId: 'task-1',
    taskVersion,
    eventType,
    occurredAt: '2026-07-25T12:00:00Z',
    payload: {
      reasonCode: 'PUBLIC_REASON',
      displayMessage: '公开状态已更新',
      status: 'RUNNING',
      ...payload,
    },
  }
}

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
