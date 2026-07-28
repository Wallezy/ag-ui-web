import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ApiRequestError,
  classifyOaSessionFailure,
} from '../src/features/agents/api-error.ts'

test('treats only HTTP 401 as an OA login requirement', () => {
  assert.deepEqual(
    classifyOaSessionFailure(
      new ApiRequestError(401, '当前浏览器没有有效 OA 登录态')
    ),
    {
      kind: 'login-required',
      message: '当前浏览器没有有效 OA 登录态',
    }
  )
})

test('keeps service failures on the Agent page instead of redirecting', () => {
  assert.deepEqual(
    classifyOaSessionFailure(
      new ApiRequestError(503, '<html>Service Temporarily Unavailable</html>')
    ),
    {
      kind: 'unavailable',
      message: 'Agent 服务暂时不可用（HTTP 503），请稍后重试。',
    }
  )
})

test('treats network failures as service unavailability', () => {
  assert.deepEqual(classifyOaSessionFailure(new TypeError('Failed to fetch')), {
    kind: 'unavailable',
    message: '无法连接 Agent 服务，请检查服务状态后重试。',
  })
})

test('keeps structured business error metadata separate from the message', () => {
  const details = { field: 'workDate', allowedWorkDates: ['2026-07-15'] }
  const error = new ApiRequestError(400, '这个日期不能登记工时', {
    code: 'WORK_HOUR_DATE_NOT_ALLOWED',
    details,
    auditId: 'audit-1',
  })

  assert.equal(error.message, '这个日期不能登记工时')
  assert.equal(error.code, 'WORK_HOUR_DATE_NOT_ALLOWED')
  assert.equal(error.errorCode, 'WORK_HOUR_DATE_NOT_ALLOWED')
  assert.deepEqual(error.details, details)
  assert.equal(error.auditId, 'audit-1')
})
