import assert from 'node:assert/strict'
import test from 'node:test'
import { parseExecutionProgress } from '../src/features/agents/execution-progress-data.ts'

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
