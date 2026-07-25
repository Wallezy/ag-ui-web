import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AgentTaskViewStore,
  initialAgentTaskViewState,
  parseOaPublicAgentEvent,
  reduceAgentTaskViewState,
} from '../src/features/agents/oa-public-events.ts'

test('parses the v2 envelope and rejects unknown or unsafe input', () => {
  assert.equal(parseOaPublicAgentEvent(event('understanding'))?.schemaVersion, 2)
  assert.equal(
    parseOaPublicAgentEvent({ ...event('future'), schemaVersion: 3 }),
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

function event(
  eventId: string,
  taskVersion = 1,
  eventType = 'OA_UNDERSTANDING_READY',
  payload: Record<string, unknown> = {}
) {
  return {
    schemaVersion: 2,
    eventId,
    traceId: 'trace-1',
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
