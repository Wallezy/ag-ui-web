import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiRequestError } from '../src/features/agents/api-error.ts'
import type { WorkHourOptionsResponse } from '../src/features/agents/api.ts'
import {
  highWorkHourConfirmation,
  highWorkHourConfirmationDetails,
  isAllowedWorkHourDate,
  isWorkHourDateEditable,
  workHourDateOptions,
  workHourErrorMessage,
  workHourLimits,
} from '../src/features/agents/work-hour.ts'

test('uses the exact non-contiguous date list returned by the BFF', () => {
  const options = createOptions({
    workDate: '2026-07-15',
    allowedWorkDates: ['2026-07-15', '2026-07-13', '2026-07-08'],
    supplementWorkDates: ['2026-07-08'],
  })

  assert.deepEqual(workHourDateOptions(options), [
    { date: '2026-07-15', supplemental: false, label: '2026-07-15' },
    { date: '2026-07-13', supplemental: false, label: '2026-07-13' },
    { date: '2026-07-08', supplemental: true, label: '2026-07-08（补登）' },
  ])
  assert.equal(isAllowedWorkHourDate(options, '2026-07-08'), true)
  assert.equal(isAllowedWorkHourDate(options, '2026-07-09'), false)
})

test('takes form limits from the server and preserves zero-hour tasks', () => {
  const taskOptions = createOptions({
    constraints: {
      minWorkHour: 0,
      maxWorkHour: 12,
      workHourScale: 1,
      minProgress: 0,
      maxProgress: 100,
      progressInteger: true,
      descriptionMaxLength: 512,
    },
  })

  assert.deepEqual(workHourLimits(taskOptions, 'task'), {
    min: 0,
    max: 12,
    step: 0.1,
    progressMin: 0,
    progressMax: 100,
    progressInteger: true,
    descriptionRequired: true,
    descriptionMaxLength: 512,
    evidenceRequiredProgress: 100,
  })
})

test('does not invent a work-hour maximum when the OA policy returns null', () => {
  const options = createOptions({
    constraints: {
      minWorkHour: 0,
      maxWorkHour: null,
    },
  })

  assert.equal(workHourLimits(options, 'task').max, undefined)
})

test('does not require evidence when the OA policy returns a null threshold', () => {
  const options = createOptions({
    type: 'bug',
    constraints: { evidenceRequiredAtProgress: null },
  })

  assert.equal(workHourLimits(options, 'bug').evidenceRequiredProgress, undefined)
})

test('keeps an old task date editable without widening the policy date list', () => {
  const options = createOptions({
    operationMode: 'edit',
    workDate: '2026-06-30',
    originalWorkDate: '2026-06-30',
    allowedWorkDates: ['2026-07-15', '2026-07-14'],
    retainedExistingDateAllowed: true,
    dateEditable: true,
  })

  assert.deepEqual(workHourDateOptions(options).at(-1), {
    date: '2026-06-30',
    source: 'RETAINED',
    label: '2026-06-30（原登记日期）',
  })
  assert.equal(isAllowedWorkHourDate(options, '2026-06-30'), true)
  assert.equal(isWorkHourDateEditable(options), true)
  assert.deepEqual(options.allowedWorkDates, ['2026-07-15', '2026-07-14'])
})

test('locks the work date when the BFF marks an edit as non-editable', () => {
  const options = createOptions({
    operationMode: 'edit',
    dateEditable: false,
    allowedWorkDates: ['2026-07-15'],
  })

  assert.equal(isWorkHourDateEditable(options), false)
})

test('asks for confirmation only when the projected total exceeds the policy threshold', () => {
  const options = createOptions({
    workDate: '2026-07-15',
    existingExecution: { workHour: 2 },
    userWorkHours: [{ date: '2026-07-15', workHour: 6 }],
    hiddenWorkHours: [
      { date: '2026-07-15', workHour: 1, type: '4' },
      { date: '2026-07-15', workHour: 8, type: '99' },
    ],
    constraints: {
      highWorkHourConfirmationThreshold: 7.5,
      highWorkHourConfirmationRequired: true,
    },
  })

  assert.deepEqual(
    highWorkHourConfirmation(options, 3, new Date('2026-07-15T10:00:00')),
    { required: true, threshold: 7.5, total: 8 }
  )
  assert.equal(
    highWorkHourConfirmation(options, 2.5, new Date('2026-07-15T10:00:00'))
      .required,
    false
  )
})

test('does not subtract the original entry after a task is moved to another date', () => {
  const options = createOptions({
    workDate: '2026-07-15',
    originalWorkDate: '2026-07-14',
    existingExecution: { workDate: '2026-07-14', workHour: 2 },
    registeredWorkHours: 6,
    constraints: { highWorkHourConfirmationThreshold: 7.5 },
  })

  assert.deepEqual(highWorkHourConfirmation(options, 2), {
    required: true,
    threshold: 7.5,
    total: 8,
  })
})

test('keeps the OA after-hours exemption when there are no hidden hours', () => {
  const options = createOptions({
    workDate: '2026-07-15',
    userWorkHours: [{ date: '2026-07-15', workHour: 7 }],
    constraints: {
      highWorkHourConfirmationThreshold: 7.5,
      overtimeConfirmAfterHour: 20,
      overtimeConfirmTodayAfterHourExempt: true,
    },
  })

  assert.equal(
    highWorkHourConfirmation(options, 1, new Date(2026, 6, 15, 20, 30))
      .required,
    false
  )
})

test('prefers BFF daily totals so the confirmation matches server validation', () => {
  const options = createOptions({
    registeredWorkHours: 7,
    overtimeHiddenWorkHours: 1,
    userWorkHours: [],
    hiddenWorkHours: [],
    constraints: { highWorkHourConfirmationThreshold: 7.5 },
  })

  assert.deepEqual(highWorkHourConfirmation(options, 1), {
    required: true,
    threshold: 7.5,
    total: 9,
  })
})

test('maps internal work-hour codes to actionable copy without exposing codes', () => {
  const error = new ApiRequestError(
    400,
    'WORK_HOUR_DATE_NOT_ALLOWED: request rejected',
    { code: 'WORK_HOUR_DATE_NOT_ALLOWED' }
  )
  const message = workHourErrorMessage(error)

  assert.equal(message, '这个日期当前不能登记工时，请从可选日期中重新选择。')
  assert.equal(message.includes('WORK_HOUR_'), false)
})

test('provides stable copy for the main work-hour failure categories', () => {
  const cases = [
    ['WORK_HOUR_DATE_LOCKED', '这条工时的登记日期不能修改，请保留原日期。'],
    ['WORK_HOUR_DUPLICATE', '该日期已有工时记录，请刷新表单后进行修改。'],
    ['WORK_HOUR_FORBIDDEN', '你当前不能登记或编辑这条工时，请重新打开表单；仍有问题请联系项目负责人。'],
    ['WORK_ITEM_NOT_EXECUTABLE', '该工作项当前不可登记工时，可能已完成、取消或所属项目已归档。'],
    ['WORK_HOUR_ATTENDANCE_MISSING', '该日期没有有效考勤记录，暂时不能登记工时。'],
    ['WORK_HOUR_ATTENDANCE_EXCEEDED', '登记工时超过该日期可填上限，请调整工时后重试。'],
    ['WORK_HOUR_SUBMISSION_IN_PROGRESS', '正在保存，请稍候。'],
    ['WORK_HOUR_SUBMISSION_UNKNOWN', '保存结果暂时无法确认，请先在 OA 中核对，避免重复登记。'],
  ] as const

  for (const [code, expected] of cases) {
    assert.equal(workHourErrorMessage({ errorCode: code }), expected)
  }
})

test('does not expose browser network errors', () => {
  assert.equal(
    workHourErrorMessage(new TypeError('Failed to fetch')),
    '无法连接 OA 服务，请检查网络后重试。'
  )
})

test('uses server confirmation totals when they are returned in error details', () => {
  const error = new ApiRequestError(422, '请确认', {
    code: 'WORK_HOUR_CONFIRMATION_REQUIRED',
    details: { projectedDailyHours: 8.6, threshold: 7.5 },
  })

  assert.deepEqual(
    highWorkHourConfirmationDetails(error, { total: 8, threshold: 7.5 }),
    { total: 8.6, threshold: 7.5 }
  )
})

function createOptions(
  patch: Partial<WorkHourOptionsResponse> = {}
): WorkHourOptionsResponse {
  return {
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
    allowedWorkDates: ['2026-07-15'],
    ...patch,
  }
}
