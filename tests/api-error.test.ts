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
