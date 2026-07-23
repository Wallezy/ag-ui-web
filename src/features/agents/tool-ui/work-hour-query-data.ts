import {
  isRecord,
  numberValue,
  readBoolean,
  readRecordList,
  readString,
} from './shared.ts'

export type UserWorkHoursResult = {
  targetUserName?: string
  dateRange?: Record<string, unknown>
  totalWorkHours: number
  recordCount: number
  activeDayCount: number
  typeBreakdown: Array<{
    typeName: string
    workHours: number
  }>
  complete: boolean
}

export function parseUserWorkHoursResult(
  value: Record<string, unknown> | undefined
): UserWorkHoursResult | undefined {
  if (!value) return undefined

  const summary = isRecord(value.summary) ? value.summary : undefined
  if (!summary) return undefined

  const targetUser = isRecord(value.targetUser) ? value.targetUser : undefined
  const dateRange = isRecord(value.dateRange) ? value.dateRange : undefined
  const completeness = isRecord(value.completeness)
    ? value.completeness
    : undefined
  const typeBreakdown = (readRecordList(value.typeBreakdown) ?? [])
    .map((item) => {
      const typeName =
        readString(item.typeName)?.trim() || readString(item.type)?.trim()
      const workHours = numberValue(item.workHours)
      if (!typeName || workHours === undefined) return undefined
      return { typeName, workHours }
    })
    .filter((item): item is { typeName: string; workHours: number } =>
      Boolean(item)
    )

  return {
    targetUserName: readString(targetUser?.userName)?.trim() || undefined,
    dateRange,
    totalWorkHours: numberValue(summary.totalWorkHours) ?? 0,
    recordCount: numberValue(summary.recordCount) ?? 0,
    activeDayCount: numberValue(summary.activeDayCount) ?? 0,
    typeBreakdown,
    complete:
      readBoolean(completeness?.complete) !== false &&
      readBoolean(value.detailsTruncated) !== true,
  }
}
