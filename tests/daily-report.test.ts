import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiRequestError } from '../src/features/agents/api-error.ts'
import {
  dailyReportErrorMessage,
  dailyReportOperationCopy,
  dailyReportOperationMode,
} from '../src/features/agents/daily-report.ts'

test('recognizes an existing OA report as update mode', () => {
  assert.equal(dailyReportOperationMode('update'), 'update')
  assert.equal(dailyReportOperationMode('create', true), 'update')
  assert.equal(dailyReportOperationMode(undefined), 'create')
})

test('uses save language throughout the update flow', () => {
  assert.deepEqual(dailyReportOperationCopy('update'), {
    readyTitle: '已加载今天的日报',
    pendingStatus: '待保存',
    readyAction: '修改已准备好',
    description: '你可以直接修改工作总结，保存前请核对日报明细。',
    reportBadge: '当前日报',
    confirmLabel: '确认保存修改',
  })
})

test('maps daily report failures to actionable copy', () => {
  assert.equal(
    dailyReportErrorMessage({ errorCode: 'DAILY_REPORT_DRAFT_EXPIRED' }),
    '这份日报信息已失效，请重新加载今天的日报后再修改。'
  )
  assert.equal(
    dailyReportErrorMessage({ errorCode: 'DAILY_REPORT_ALREADY_EXISTS' }),
    '日报已提交：无需重新再提交，是否需要修改。'
  )
  assert.equal(
    dailyReportErrorMessage({ errorCode: 'DAILY_REPORT_SUBMISSION_UNKNOWN' }),
    '保存结果暂时无法确认，请先查询今天的日报状态。'
  )
  assert.equal(
    dailyReportErrorMessage({ errorCode: 'DAILY_REPORT_RECORD_UNAVAILABLE' }),
    '暂时无法读取今天的日报编号，请重新加载后再保存。'
  )
})

test('does not expose internal daily report codes', () => {
  const error = new ApiRequestError(
    400,
    'DAILY_REPORT_INTENT_INVALID: 保存意图无效或已过期',
    { code: 'DAILY_REPORT_INTENT_INVALID' }
  )

  const message = dailyReportErrorMessage(error)

  assert.equal(message, '这份日报信息已失效，请重新加载今天的日报后再修改。')
  assert.equal(message.includes('DAILY_REPORT'), false)
})

test('keeps a plain-language server message', () => {
  assert.equal(
    dailyReportErrorMessage({ message: '日报内容过长，请精简后再保存。' }),
    '日报内容过长，请精简后再保存。'
  )
})
