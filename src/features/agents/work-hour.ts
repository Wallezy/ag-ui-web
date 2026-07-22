import { ApiRequestError } from './api-error.ts'
import type { WorkHourDateOption, WorkHourOptionsResponse } from './api.ts'

type WorkHourFailure = {
  errorCode?: string
  code?: string
  message?: string
  details?: unknown
  auditId?: string
}

export function workHourDateOptions(
  options: WorkHourOptionsResponse | null
): WorkHourDateOption[] {
  if (!options) return []

  const supplementalDates = new Set([
    ...(options.supplementWorkDates ?? []),
    ...(options.supplementalWorkDates ?? []),
  ])
  const source = options.workDateOptions?.length
    ? options.workDateOptions
    : options.allowedWorkDates
  const result: WorkHourDateOption[] = []
  const seen = new Set<string>()

  for (const entry of source ?? []) {
    const normalized =
      typeof entry === 'string' ? { date: entry } : { ...entry }
    if (!normalized.date || seen.has(normalized.date)) continue
    seen.add(normalized.date)
    const supplemental =
      normalized.supplemental === true ||
      normalized.source === 'SUPPLEMENT' ||
      supplementalDates.has(normalized.date)
    result.push({
      ...normalized,
      supplemental,
      label:
        normalized.source === 'RETAINED'
          ? `${normalized.date}（原登记日期）`
          : supplemental
            ? normalized.label?.includes('补登')
              ? normalized.label
              : `${normalized.date}（补登）`
            : normalized.label || normalized.date,
    })
  }

  const retainedDate =
    options.retainedWorkDate ||
    options.originalWorkDate ||
    text(options.existingExecution?.workDate)
  const retainedDateAllowed =
    options.retainedExistingDateAllowed ??
    options.constraints?.retainedExistingDateAllowed ??
    false
  if (
    options.operationMode === 'edit' &&
    retainedDateAllowed &&
    retainedDate &&
    !seen.has(retainedDate)
  ) {
    result.push({
      date: retainedDate,
      source: 'RETAINED',
      label: `${retainedDate}（原登记日期）`,
    })
  }

  if (result.length === 0 && options.workDate) {
    result.push({ date: options.workDate, label: options.workDate })
  }
  return result
}

export function isWorkHourDateEditable(
  options: WorkHourOptionsResponse | null
) {
  if (!options) return false
  return options.dateEditable ?? options.constraints?.dateEditable ?? true
}

export function isAllowedWorkHourDate(
  options: WorkHourOptionsResponse | null,
  workDate: string
) {
  return workHourDateOptions(options).some((item) => item.date === workDate)
}

export function hasPositiveWorkHour(workHours: Iterable<number>) {
  for (const workHour of workHours) {
    if (Number.isFinite(workHour) && workHour > 0) return true
  }
  return false
}

export function workHourLimits(
  options: WorkHourOptionsResponse | null,
  type: 'task' | 'bug'
) {
  const constraints = options?.constraints
  const scale = finiteNumber(constraints?.workHourScale) ?? 1
  const configuredEvidenceProgress =
    finiteNumber(constraints?.evidenceRequiredProgress) ??
    finiteNumber(constraints?.evidenceRequiredAtProgress)
  const evidenceDisabled =
    configuredEvidenceProgress === undefined &&
    (constraints?.evidenceRequiredProgress === null ||
      constraints?.evidenceRequiredAtProgress === null)
  return {
    min: finiteNumber(constraints?.minWorkHour) ?? (type === 'task' ? 0 : 0.1),
    max: finiteNumber(constraints?.maxWorkHour),
    step: 1 / 10 ** Math.max(0, Math.floor(scale)),
    progressMin: finiteNumber(constraints?.minProgress) ?? 1,
    progressMax: finiteNumber(constraints?.maxProgress) ?? 100,
    progressInteger: constraints?.progressInteger !== false,
    descriptionRequired: constraints?.descriptionRequired !== false,
    descriptionMaxLength:
      finiteNumber(constraints?.descriptionMaxLength) ?? 512,
    evidenceRequiredProgress: evidenceDisabled
      ? undefined
      : (configuredEvidenceProgress ?? 100),
  }
}

export function highWorkHourConfirmation(
  options: WorkHourOptionsResponse,
  enteredWorkHour: number,
  now = new Date()
) {
  const constraints = options.constraints
  const threshold =
    finiteNumber(constraints?.highWorkHourConfirmationThreshold) ??
    finiteNumber(constraints?.overtimeConfirmThreshold) ??
    7.5
  const originalWorkDate =
    options.originalWorkDate || text(options.existingExecution?.workDate)
  const existingWorkHour =
    !originalWorkDate || originalWorkDate === options.workDate
      ? (finiteNumber(options.existingExecution?.workHour) ?? 0)
      : 0
  const currentUserHours =
    finiteNumber(options.registeredWorkHours) ??
    workHoursForDate(options.userWorkHours, options.workDate)
  const currentHiddenHours =
    finiteNumber(options.overtimeHiddenWorkHours) ??
    hiddenWorkHoursForDate(options.hiddenWorkHours, options.workDate)
  const total =
    Math.max(0, currentUserHours - existingWorkHour) +
    currentHiddenHours +
    enteredWorkHour
  const afterHour = finiteNumber(constraints?.overtimeConfirmAfterHour) ?? 20
  const afterHourExempt =
    constraints?.overtimeConfirmTodayAfterHourExempt === true &&
    options.workDate === localDateText(now) &&
    now.getHours() >= afterHour &&
    currentHiddenHours <= 0
  const requiredByPolicy =
    constraints?.highWorkHourConfirmationRequired !== false

  return {
    required: requiredByPolicy && !afterHourExempt && total > threshold,
    threshold,
    total,
  }
}

function workHourErrorCode(error: unknown) {
  if (error instanceof ApiRequestError) return error.code ?? ''
  if (isRecord(error)) {
    if (typeof error.errorCode === 'string') return error.errorCode
    if (typeof error.code === 'string') return error.code
  }
  return ''
}

export function isHighWorkHourConfirmationRequired(error: unknown) {
  return workHourErrorCode(error) === 'WORK_HOUR_CONFIRMATION_REQUIRED'
}

export function highWorkHourConfirmationDetails(
  error: unknown,
  fallback: { total: number; threshold: number }
) {
  const details =
    error instanceof ApiRequestError
      ? error.details
      : isRecord(error)
        ? error.details
        : undefined
  if (!isRecord(details)) return fallback
  return {
    total: finiteNumber(details.projectedDailyHours) ?? fallback.total,
    threshold: finiteNumber(details.threshold) ?? fallback.threshold,
  }
}

export function workHourErrorMessage(
  error: unknown,
  fallback = '暂时无法保存，请稍后重试。'
) {
  const code = workHourErrorCode(error).toUpperCase()

  if (code.includes('DATE_LOCKED')) {
    return '这条工时的登记日期不能修改，请保留原日期。'
  }
  if (code.includes('DATE_NOT_ALLOWED') || code === 'DATE_FORMAT_INVALID') {
    return '这个日期当前不能登记工时，请从可选日期中重新选择。'
  }
  if (code.includes('DUPLICATE')) {
    return '该日期已有工时记录，请刷新表单后进行修改。'
  }
  if (code.includes('ALREADY_SUBMITTED')) {
    return '这条工时已经提交，无需重复保存。'
  }
  if (code.includes('SOURCE_CHANGED')) {
    return '这条工时已在 OA 中发生变化，请刷新表单后重新确认。'
  }
  if (code.includes('ATTENDANCE_MISSING')) {
    return '该日期没有有效考勤记录，暂时不能登记工时。'
  }
  if (code.includes('ATTENDANCE_EXCEEDED')) {
    return '登记工时超过该日期可填上限，请调整工时后重试。'
  }
  if (code.includes('SUBMISSION_IN_PROGRESS')) {
    return '正在保存，请稍候。'
  }
  if (code.includes('SUBMISSION_UNKNOWN') || code.includes('STATE_CONFLICT')) {
    return '保存结果暂时无法确认，请先在 OA 中核对，避免重复登记。'
  }
  if (code.includes('INTENT_INVALID')) {
    return '表单信息已失效，请刷新后重试。'
  }
  if (code.includes('FORBIDDEN') || code.includes('PERMISSION')) {
    return '你当前不能登记或编辑这条工时，请重新打开表单；仍有问题请联系项目负责人。'
  }
  if (
    code.includes('PROJECT_ARCHIVED') ||
    code.includes('NOT_EXECUTABLE') ||
    code.includes('WORK_ITEM_INVALID')
  ) {
    return '该工作项当前不可登记工时，可能已完成、取消或所属项目已归档。'
  }
  if (code.includes('EVIDENCE_REQUIRED')) {
    return '任务完成时需要补充物证，请完善后再保存。'
  }
  if (code.includes('CONFIRMATION_REQUIRED')) {
    return '当天累计工时超过标准工时，请确认后再保存。'
  }
  if (code.includes('POLICY_UNAVAILABLE')) {
    return '暂时无法读取工时登记规则，请稍后重试。'
  }
  if (
    code.includes('HTTP_SERVER_ERROR') ||
    code.includes('TRANSPORT_ERROR') ||
    code.includes('RESPONSE_JSON_FAILED') ||
    code.includes('REQUEST_INTERRUPTED') ||
    code.includes('TOOL_FAILED')
  ) {
    return 'OA 服务暂时不可用，请稍后重试。'
  }
  if (error instanceof TypeError) {
    return '无法连接 OA 服务，请检查网络后重试。'
  }

  const message = publicMessage(error)
  return message || fallback
}

function workHoursForDate(
  records: Record<string, unknown>[],
  workDate: string
) {
  return records.reduce((total, record) => {
    const date = text(record.date) || text(record.workDate)
    if (date && date !== workDate) return total
    return (
      total + (finiteNumber(record.workHour) ?? finiteNumber(record.hours) ?? 0)
    )
  }, 0)
}

function hiddenWorkHoursForDate(
  records: Record<string, unknown>[],
  workDate: string
) {
  return workHoursForDate(
    records.filter((record) => {
      const type =
        typeof record.type === 'number'
          ? String(record.type)
          : text(record.type)
      return type === '4' || type === '36'
    }),
    workDate
  )
}

function publicMessage(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : isRecord(error) && typeof error.message === 'string'
        ? error.message
        : ''
  const message = raw.replace(/^[A-Z][A-Z0-9_]+\s*:\s*/, '').trim()
  if (
    !message ||
    message.length > 160 ||
    /<html|exception|stack trace|request failed/i.test(message)
  ) {
    return ''
  }
  return message
}

function finiteNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(
  value: unknown
): value is WorkHourFailure & Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function localDateText(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
