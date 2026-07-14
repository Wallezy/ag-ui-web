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

function progressLine(
  stepId: string,
  phase: 'understanding' | 'routing' | 'tool' | 'response',
  status: 'running' | 'completed' | 'failed',
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
