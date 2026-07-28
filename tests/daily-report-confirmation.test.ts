import assert from 'node:assert/strict'
import test from 'node:test'
import { isDailyReportConfirmationAccepted } from '../src/features/agents/daily-report-confirmation.ts'

test('accepts an explicitly accepted daily report submission', () => {
  assert.equal(
    isDailyReportConfirmationAccepted({ status: 'ACCEPTED' }),
    true
  )
})

test('rejects a rejected submission even when no error code is present', () => {
  assert.equal(
    isDailyReportConfirmationAccepted({ status: 'REJECTED' }),
    false
  )
})

test('does not accept an unknown or missing status', () => {
  assert.equal(
    isDailyReportConfirmationAccepted({ status: 'UNKNOWN' }),
    false
  )
  assert.equal(isDailyReportConfirmationAccepted({}), false)
})
