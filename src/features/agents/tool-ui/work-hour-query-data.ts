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
  details: Array<{
    workDate?: string
    typeName?: string
    projectName?: string
    title?: string
    workHours: number
    workCategory?: string
    executionDesc?: string
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
  const details = (readRecordList(value.days) ?? []).flatMap((day) => {
    const workDate = readString(day.workDate)?.trim() || undefined
    return (readRecordList(day.details) ?? [])
      .map((detail) => {
        const typeName = readString(detail.typeName)?.trim() || undefined
        const projectName = readString(detail.projectName)?.trim() || undefined
        const title = readString(detail.title)?.trim() || undefined
        const workCategory =
          readString(detail.workCategory)?.trim() || undefined
        const executionDesc =
          readString(detail.executionDesc)?.trim() || undefined
        const workHours = numberValue(detail.workHours) ?? 0
        if (!title && !executionDesc && !workCategory && !projectName) {
          return undefined
        }
        return {
          workDate,
          typeName,
          projectName,
          title,
          workHours,
          workCategory,
          executionDesc,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  })

  return {
    targetUserName: readString(targetUser?.userName)?.trim() || undefined,
    dateRange,
    totalWorkHours: numberValue(summary.totalWorkHours) ?? 0,
    recordCount: numberValue(summary.recordCount) ?? 0,
    activeDayCount: numberValue(summary.activeDayCount) ?? 0,
    typeBreakdown,
    details,
    complete:
      readBoolean(completeness?.complete) !== false &&
      readBoolean(value.detailsTruncated) !== true,
  }
}
