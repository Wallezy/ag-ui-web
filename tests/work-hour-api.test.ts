import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getWorkHourOptions,
  saveWorkHourExecutionWithIntentRefresh,
  type SaveWorkHourExecutionRequest,
} from '../src/features/agents/api.ts'
import { ApiRequestError } from '../src/features/agents/api-error.ts'

test('loads the complete work-hour form through one Agent BFF request', async () => {
  const originalFetch = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    return jsonResponse({
      type: 'task',
      workItemId: 'task-1',
      workDate: '2026-07-15',
      operationMode: 'create',
      workCategories: [],
      userWorkHours: [],
      hiddenWorkHours: [],
      evidences: [],
      projectBases: [],
      designs: [],
      idempotencyKey: 'intent-1',
      allowedWorkDates: ['2026-07-15', '2026-07-14'],
    })
  }

  try {
    const result = await getWorkHourOptions(
      { type: 'task', id: 'task-1' },
      '2026-07-14',
      'conversation-1'
    )

    assert.equal(calls.length, 1)
    assert.match(calls[0], /^\/api\/agent\/oa\/work-hours\/options\?/)
    assert.match(calls[0], /workDate=2026-07-14/)
    assert.deepEqual(result.allowedWorkDates, [
      '2026-07-15',
      '2026-07-14',
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('preserves structured BFF error fields without prefixing the public message', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    jsonResponse(
      {
        code: 'WORK_HOUR_DATE_NOT_ALLOWED',
        message: '这个日期暂时不能登记工时',
        details: { allowedWorkDates: ['2026-07-15'] },
        auditId: 'audit-1',
      },
      422
    )

  try {
    await assert.rejects(
      getWorkHourOptions(
        { type: 'task', id: 'task-1' },
        '2026-07-01',
        'conversation-1'
      ),
      (error) => {
        assert.ok(error instanceof ApiRequestError)
        assert.equal(error.message, '这个日期暂时不能登记工时')
        assert.equal(error.code, 'WORK_HOUR_DATE_NOT_ALLOWED')
        assert.deepEqual(error.details, {
          allowedWorkDates: ['2026-07-15'],
        })
        assert.equal(error.auditId, 'audit-1')
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fails closed when the BFF omits the allowed date policy', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    jsonResponse({
      type: 'task',
      workItemId: 'task-1',
      workDate: '2026-07-15',
      operationMode: 'create',
      workCategories: [],
      userWorkHours: [],
      hiddenWorkHours: [],
      evidences: [],
      projectBases: [],
      designs: [],
      idempotencyKey: 'intent-1',
    })

  try {
    await assert.rejects(
      getWorkHourOptions(
        { type: 'task', id: 'task-1' },
        '2026-07-15',
        'conversation-1'
      ),
      (error) =>
        error instanceof ApiRequestError &&
        error.code === 'WORK_HOUR_POLICY_UNAVAILABLE'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('refreshes an invalid intent and retries the rejected write only once', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; body?: string }> = []
  let saveAttempts = 0
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
    if (url.endsWith('/intents')) {
      return jsonResponse({
        type: 'task',
        workItemId: 'task-1',
        workDate: '2026-07-15',
        idempotencyKey: 'intent-refreshed',
      })
    }
    saveAttempts += 1
    if (saveAttempts === 1) {
      return jsonResponse(
        {
          status: 'REJECTED',
          errorCode: 'WORK_HOUR_INTENT_INVALID',
          message: '工时保存意图无效',
          details: { signedDate: '2026-07-14' },
          auditId: '',
        },
        400
      )
    }
    return jsonResponse({ status: 'ACCEPTED', message: '保存成功' })
  }

  try {
    const result = await saveWorkHourExecutionWithIntentRefresh(
      savePayload(),
      'conversation-1'
    )

    assert.equal(result.status, 'ACCEPTED')
    assert.equal(saveAttempts, 2)
    assert.equal(calls.length, 3)
    assert.equal(JSON.parse(calls[1].body ?? '{}').executionId, 'execution-1')
    assert.equal(
      JSON.parse(calls[1].body ?? '{}').originalWorkDate,
      '2026-07-14'
    )
    assert.equal(JSON.parse(calls[2].body ?? '{}').idempotencyKey, 'intent-refreshed')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('does not refresh a second time when the retried intent is rejected', async () => {
  const originalFetch = globalThis.fetch
  let intentCalls = 0
  let saveCalls = 0
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/intents')) {
      intentCalls += 1
      return jsonResponse({
        type: 'task',
        workItemId: 'task-1',
        workDate: '2026-07-15',
        idempotencyKey: 'intent-refreshed',
      })
    }
    saveCalls += 1
    return jsonResponse(
      {
        status: 'REJECTED',
        errorCode: 'WORK_HOUR_INTENT_INVALID',
        message: '工时保存意图无效',
      },
      400
    )
  }

  try {
    await assert.rejects(
      saveWorkHourExecutionWithIntentRefresh(
        savePayload(),
        'conversation-1'
      ),
      (error) =>
        error instanceof ApiRequestError &&
        error.code === 'WORK_HOUR_INTENT_INVALID'
    )
    assert.equal(saveCalls, 2)
    assert.equal(intentCalls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

function savePayload(): SaveWorkHourExecutionRequest {
  return {
    type: 'task',
    workItemId: 'task-1',
    executionId: 'execution-1',
    originalWorkDate: '2026-07-14',
    workDate: '2026-07-15',
    workCategory: '开发',
    workHour: 1,
    progress: 50,
    executionDesc: '完成开发',
    idempotencyKey: 'intent-old',
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
