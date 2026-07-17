export type DailyReportStatusResolution<T> = {
  found: boolean
  payload: Record<string, unknown>
  draft?: T
}

type DailyReportEditState = {
  currentRemark: string
  savedRemark: string
  currentOverdueReasons: Record<string, string>
  savedOverdueReasons: Record<string, string>
}

type DailyReportPersistedState = {
  existingReport: boolean
  submitted: boolean
  hasUnsavedChanges: boolean
}

export function resolveDailyReportStatus<T>(
  result: Record<string, unknown> | undefined,
  parseDraft: (payload: Record<string, unknown>) => T | undefined
): DailyReportStatusResolution<T> | undefined {
  if (!result) return undefined

  const nestedPayload = ['dailyReport', 'report', 'detail', 'draft']
    .map((key) => result[key])
    .find(isRecord)
  const payload = nestedPayload ? { ...result, ...nestedPayload } : result
  const explicitlyFound = booleanValue(payload.found)

  if (explicitlyFound === false) {
    return { found: false, payload }
  }

  const draft = parseDraft(payload)
  const found =
    explicitlyFound ??
    Boolean(
      draft ||
      textValue(payload.content) ||
      textValue(payload.remark) ||
      textValue(payload.oaReportId)
    )

  return { found, payload, draft }
}

export function hasUnsavedDailyReportChanges({
  currentRemark,
  savedRemark,
  currentOverdueReasons,
  savedOverdueReasons,
}: DailyReportEditState) {
  if (currentRemark !== savedRemark) return true

  const keys = new Set([
    ...Object.keys(currentOverdueReasons),
    ...Object.keys(savedOverdueReasons),
  ])
  return Array.from(keys).some(
    (key) =>
      normalizedReason(currentOverdueReasons[key]) !==
      normalizedReason(savedOverdueReasons[key])
  )
}

export function isDailyReportPersisted({
  existingReport,
  submitted,
  hasUnsavedChanges,
}: DailyReportPersistedState) {
  return submitted || (existingReport && !hasUnsavedChanges)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function normalizedReason(value: string | undefined) {
  return value?.trim() ?? ''
}
