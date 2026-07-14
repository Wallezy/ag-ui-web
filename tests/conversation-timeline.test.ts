import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_AGENT_RUN_ERROR_MESSAGE,
  timelineToThreadMessages,
} from '../src/features/agents/api.ts'

test('restores a persisted RUN_ERROR as a visible assistant error', () => {
  const messages = timelineToThreadMessages([
    {
      id: 'user-entry-1',
      kind: 'user_message',
      timestamp: 1_000,
      message: {
        id: 'user-message-1',
        role: 'user',
        content: '我要写日报',
        createdAt: 1_000,
      },
    },
    {
      id: 'run-started-1',
      kind: 'agui_event',
      timestamp: 2_000,
      event: { type: 'RUN_STARTED' },
    },
    {
      id: 'run-error-1',
      kind: 'agui_event',
      timestamp: 3_000,
      event: { type: 'RUN_ERROR', message: '上游服务暂时不可用。' },
    },
  ])

  assert.equal(messages.length, 2)
  assert.equal(messages[1]?.role, 'assistant')
  assert.deepEqual(messages[1]?.content, [])
  assert.deepEqual(messages[1]?.status, {
    type: 'incomplete',
    reason: 'error',
    error: '上游服务暂时不可用。',
  })
})

test('uses a safe fallback when RUN_ERROR has no public message', () => {
  const messages = timelineToThreadMessages([
    {
      id: 'run-started-1',
      kind: 'agui_event',
      timestamp: 1_000,
      event: { type: 'RUN_STARTED' },
    },
    {
      id: 'run-error-1',
      kind: 'agui_event',
      timestamp: 2_000,
      event: { type: 'RUN_ERROR', message: '   ' },
    },
  ])

  assert.deepEqual(messages[0]?.status, {
    type: 'incomplete',
    reason: 'error',
    error: DEFAULT_AGENT_RUN_ERROR_MESSAGE,
  })
})

test('does not leak an empty completed run into the next assistant message', () => {
  const messages = timelineToThreadMessages([
    {
      id: 'user-entry-1',
      kind: 'user_message',
      timestamp: 1_000,
      message: {
        id: 'user-message-1',
        role: 'user',
        content: '第一条消息',
        createdAt: 1_000,
      },
    },
    {
      id: 'run-started-1',
      kind: 'agui_event',
      timestamp: 2_000,
      event: { type: 'RUN_STARTED' },
    },
    {
      id: 'run-finished-1',
      kind: 'agui_event',
      timestamp: 3_000,
      event: { type: 'RUN_FINISHED' },
    },
    {
      id: 'user-entry-2',
      kind: 'user_message',
      timestamp: 4_000,
      message: {
        id: 'user-message-2',
        role: 'user',
        content: '第二条消息',
        createdAt: 4_000,
      },
    },
    {
      id: 'run-started-2',
      kind: 'agui_event',
      timestamp: 5_000,
      event: { type: 'RUN_STARTED' },
    },
    {
      id: 'text-start-2',
      kind: 'agui_event',
      timestamp: 5_100,
      event: { type: 'TEXT_MESSAGE_START', messageId: 'assistant-message-2' },
    },
    {
      id: 'text-content-2',
      kind: 'agui_event',
      timestamp: 5_200,
      event: {
        type: 'TEXT_MESSAGE_CONTENT',
        messageId: 'assistant-message-2',
        delta: '第二条回复',
      },
    },
    {
      id: 'text-end-2',
      kind: 'agui_event',
      timestamp: 5_300,
      event: { type: 'TEXT_MESSAGE_END', messageId: 'assistant-message-2' },
    },
    {
      id: 'run-finished-2',
      kind: 'agui_event',
      timestamp: 5_400,
      event: { type: 'RUN_FINISHED' },
    },
  ])

  assert.deepEqual(
    messages.map((message) => message.role),
    ['user', 'user', 'assistant']
  )
  assert.equal(messages[2]?.id, 'assistant-message-2')
  assert.equal(messages[2]?.createdAt.getTime(), 5_000)
})
