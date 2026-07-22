import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseExecutionProgress,
  visibleExecutionProgress,
} from '../src/features/agents/execution-progress-data.ts'
import { visibleToolGroupPositions } from '../src/features/agents/tool-retry-data.ts'

test('merges progress updates for the same step while preserving first-seen order', () => {
  const steps = parseExecutionProgress(
    [
      progressLine('tool:1', 'tool', 'running', '正在查询', 2),
      progressLine('understanding', 'understanding', 'completed', '已识别请求', 1),
      progressLine('tool:1', 'tool', 'completed', '查询完成', 3),
    ].join('\n')
  )

  assert.deepEqual(
    steps.map(({ stepId, status, title, firstSequence }) => ({
      stepId,
      status,
      title,
      firstSequence,
    })),
    [
      {
        stepId: 'understanding',
        status: 'completed',
        title: '已识别请求',
        firstSequence: 1,
      },
      {
        stepId: 'tool:1',
        status: 'completed',
        title: '查询完成',
        firstSequence: 2,
      },
    ]
  )
})

test('ignores raw reasoning and malformed progress records', () => {
  const steps = parseExecutionProgress(
    [
      '先分析用户真正想做什么',
      '{"stepId":"routing","status":"running"}',
      progressLine('routing', 'routing', 'completed', '已选择执行路径', 1),
    ].join('\n')
  )

  assert.equal(steps.length, 1)
  assert.equal(steps[0]?.stepId, 'routing')
})

test('accepts planning, observation, and user waiting terminal states', () => {
  const steps = parseExecutionProgress(
    [
      progressLine('planning', 'planning', 'completed', '计划已确定', 1),
      progressLine(
        'observation:1',
        'observation',
        'completed',
        '已观察结果',
        2
      ),
      progressLine(
        'response',
        'response',
        'waiting_confirmation',
        '等待确认',
        3
      ),
    ].join('\n')
  )

  assert.deepEqual(
    steps.map(({ phase, status }) => ({ phase, status })),
    [
      { phase: 'planning', status: 'completed' },
      { phase: 'observation', status: 'completed' },
      { phase: 'response', status: 'waiting_confirmation' },
    ]
  )
})

test('shows the complete safe decision and execution trace', () => {
  const steps = visibleExecutionProgress(
    parseExecutionProgress(
      [
        progressLine(
          'understanding',
          'understanding',
          'completed',
          '已完成初步意图识别',
          1
        ),
        progressLine(
          'planning',
          'planning',
          'completed',
          '执行计划已确定',
          2
        ),
        progressLine(
          'tool:1',
          'tool',
          'completed',
          '日报数据已检查',
          3
        ),
        progressLine(
          'observation:1',
          'observation',
          'completed',
          '已观察业务结果',
          4
        ),
        progressLine(
          'outcome',
          'response',
          'waiting_user',
          '可登记工时事项已就绪',
          5
        ),
        progressLine(
          'response',
          'response',
          'completed',
          '处理完成',
          6
        ),
      ].join('\n')
    )
  )

  assert.deepEqual(
    steps.map(({ stepId, title }) => ({ stepId, title })),
    [
      { stepId: 'understanding', title: '已完成初步意图识别' },
      { stepId: 'planning', title: '执行计划已确定' },
      { stepId: 'tool:1', title: '日报数据已检查' },
      { stepId: 'observation:1', title: '已观察业务结果' },
      { stepId: 'outcome', title: '可登记工时事项已就绪' },
      { stepId: 'response', title: '处理完成' },
    ]
  )
})

test('hides a failed tool attempt after the same operation succeeds on retry', () => {
  const steps = visibleExecutionProgress(
    parseExecutionProgress(
      [
        progressLine(
          'tool:first',
          'tool',
          'failed',
          '查询 OA 工作项失败',
          1
        ),
        progressLine(
          'observation:first',
          'observation',
          'failed',
          '业务结果不可用',
          2
        ),
        progressLine(
          'tool:retry',
          'tool',
          'completed',
          '查询 OA 工作项已完成',
          3
        ),
        progressLine(
          'response',
          'response',
          'completed',
          '处理完成',
          4
        ),
      ].join('\n')
    )
  )

  assert.deepEqual(
    steps.map(({ stepId, status }) => ({ stepId, status })),
    [
      { stepId: 'tool:retry', status: 'completed' },
      { stepId: 'response', status: 'completed' },
    ]
  )
})

test('keeps a failed tool attempt when no later retry succeeds', () => {
  const steps = visibleExecutionProgress(
    parseExecutionProgress(
      [
        progressLine(
          'tool:first',
          'tool',
          'failed',
          '查询 OA 工作项失败',
          1
        ),
        progressLine(
          'response',
          'response',
          'completed',
          '处理完成',
          2
        ),
      ].join('\n')
    )
  )

  assert.deepEqual(
    steps.map(({ stepId, status }) => ({ stepId, status })),
    [
      { stepId: 'tool:first', status: 'failed' },
      { stepId: 'response', status: 'completed' },
    ]
  )
})

test('hides a failed tool card after the same tool succeeds on retry', () => {
  const parts = [
    {
      type: 'tool-call',
      toolName: 'getMyWorkItems',
      result: JSON.stringify({
        success: false,
        errorCode: 'WORK_ITEM_TARGET_USER_NOT_FOUND',
      }),
    },
    {
      type: 'tool-call',
      toolName: 'getMyWorkItems',
      result: { success: true, result: { count: 0 } },
    },
  ]

  assert.deepEqual(visibleToolGroupPositions(parts, [0, 1]), [1])
})

test('keeps failed tool cards when a different operation succeeds', () => {
  const parts = [
    {
      type: 'tool-call',
      toolName: 'getMyWorkItems',
      result: { success: false, errorCode: 'WORK_ITEM_QUERY_FAILED' },
    },
    {
      type: 'tool-call',
      toolName: 'queryDailyReportStatus',
      result: { success: true },
    },
  ]

  assert.deepEqual(visibleToolGroupPositions(parts, [0, 1]), [0, 1])
})

function progressLine(
  stepId: string,
  phase:
    | 'understanding'
    | 'routing'
    | 'planning'
    | 'tool'
    | 'observation'
    | 'response',
  status:
    | 'running'
    | 'completed'
    | 'failed'
    | 'waiting_user'
    | 'waiting_confirmation',
  title: string,
  sequence: number
) {
  return JSON.stringify({
    kind: 'execution_progress',
    stepId,
    phase,
    status,
    title,
    detail: '',
    sequence,
  })
}
