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
      id: 'text-start-1',
      kind: 'agui_event',
      timestamp: 2_100,
      event: { type: 'TEXT_MESSAGE_START', messageId: 'assistant-message-1' },
    },
    {
      id: 'text-end-1',
      kind: 'agui_event',
      timestamp: 2_200,
      event: { type: 'TEXT_MESSAGE_END', messageId: 'assistant-message-1' },
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
  assert.deepEqual(messages[1]?.content, [
    { type: 'text', text: '上游服务暂时不可用。' },
  ])
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

test('drops an empty text lifecycle from a completed run', () => {
  const messages = timelineToThreadMessages([
    aguiEntry('run-start', 1_000, { type: 'RUN_STARTED' }),
    aguiEntry('text-start', 1_100, {
      type: 'TEXT_MESSAGE_START',
      messageId: 'empty-message',
    }),
    aguiEntry('text-end', 1_200, {
      type: 'TEXT_MESSAGE_END',
      messageId: 'empty-message',
    }),
    aguiEntry('run-finished', 1_300, { type: 'RUN_FINISHED' }),
  ])

  assert.deepEqual(messages, [])
})

test('restores structured execution progress before tools and response text', () => {
  const progress =
    '{"kind":"execution_progress","stepId":"routing","phase":"routing","status":"completed","title":"已选择执行路径","detail":"进入智能体流程","sequence":1}\n'
  const messages = timelineToThreadMessages([
    aguiEntry('run-start', 1_000, { type: 'RUN_STARTED' }),
    aguiEntry('progress-start', 1_100, {
      type: 'REASONING_MESSAGE_START',
      messageId: 'execution-progress-run-1',
    }),
    aguiEntry('progress-content', 1_200, {
      type: 'REASONING_MESSAGE_CONTENT',
      messageId: 'execution-progress-run-1',
      delta: progress,
    }),
    aguiEntry('progress-end', 1_300, {
      type: 'REASONING_MESSAGE_END',
      messageId: 'execution-progress-run-1',
    }),
    aguiEntry('tool-start', 1_400, {
      type: 'TOOL_CALL_START',
      toolCallId: 'tool-1',
      toolCallName: 'getMyWorkItems',
    }),
    aguiEntry('tool-result', 1_500, {
      type: 'TOOL_CALL_RESULT',
      toolCallId: 'tool-1',
      content: '{"success":true}',
    }),
    aguiEntry('text-start', 1_600, {
      type: 'TEXT_MESSAGE_START',
      messageId: 'reply-1',
    }),
    aguiEntry('text-content', 1_700, {
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: 'reply-1',
      delta: '处理完成',
    }),
    aguiEntry('run-finished', 1_800, { type: 'RUN_FINISHED' }),
  ])

  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0]?.content.map((part) => part.type), [
    'reasoning',
    'tool-call',
    'text',
  ])
  assert.deepEqual(messages[0]?.content[0], {
    type: 'reasoning',
    text: progress,
  })
})

function aguiEntry(
  id: string,
  timestamp: number,
  event: Record<string, unknown>
) {
  return { id, kind: 'agui_event' as const, timestamp, event }
}
