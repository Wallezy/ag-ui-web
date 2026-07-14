export type WorkItemQueryStatus = 'COMPLETE' | 'PARTIAL' | 'FAILED'

export type WorkItemQueryError = {
  type?: string
  typeName?: string
  scope?: string
  errorCode?: string
}

export type WorkItemQueryCompleteness = {
  status: WorkItemQueryStatus
  complete: boolean
  requestedTypeCount?: number
  availableTypeCount?: number
  unavailableTypeCount?: number
  unavailableStatisticsCount?: number
  unavailableWorkItemTypes: string[]
  unavailableWorkItemTypeNames: string[]
  statisticsUnavailableWorkItemTypes: string[]
  statisticsUnavailableWorkItemTypeNames: string[]
}

export type WorkItemsResult = {
  items: Record<string, unknown>[]
  count: number
  user?: Record<string, unknown>
  dateRange?: Record<string, unknown>
  visitedProjectCount?: number
  errors: WorkItemQueryError[]
  completeness: WorkItemQueryCompleteness
}

export type WorkItemQueryPresentation = {
  title: string
  badge: string
  description: string
  countLabel: string
  noticeTitle?: string
  noticeDescription?: string
  emptyTitle: string
  emptyDescription: string
}

export function parseWorkItemsResult(
  result: Record<string, unknown> | undefined
): WorkItemsResult | undefined {
  if (!result) return undefined
  const items = recordList(result.items)
  if (!items) return undefined

  const errors = (recordList(result.errors) ?? []).map((error) => {
    const phase = text(error.phase)
    return {
      type: text(error.type),
      typeName: text(error.typeName),
      scope:
        text(error.scope) ??
        (phase === 'page'
          ? 'WORK_ITEMS'
          : phase === 'metricStatistics'
            ? 'STATISTICS'
            : undefined),
      errorCode: text(error.errorCode),
    }
  })
  const queriedTypes = stringList(result.queriedWorkItemTypes)
  const rawCompleteness = isRecord(result.completeness)
    ? result.completeness
    : undefined
  const unavailableWorkItemTypes = firstNonEmptyList(
    stringList(rawCompleteness?.unavailableWorkItemTypes),
    errorTypes(errors, 'WORK_ITEMS')
  )
  const statisticsUnavailableWorkItemTypes = firstNonEmptyList(
    stringList(rawCompleteness?.statisticsUnavailableWorkItemTypes),
    errorTypes(errors, 'STATISTICS')
  )
  const explicitStatus = queryStatus(
    rawCompleteness?.status ?? result.queryStatus
  )
  const status =
    explicitStatus ??
    inferQueryStatus(errors, queriedTypes, unavailableWorkItemTypes)

  return {
    items,
    count: numberValue(result.count) ?? items.length,
    user: isRecord(result.user) ? result.user : undefined,
    dateRange: isRecord(result.dateRange) ? result.dateRange : undefined,
    visitedProjectCount: numberValue(result.visitedProjectCount),
    errors,
    completeness: {
      status,
      complete:
        booleanValue(rawCompleteness?.complete) ?? status === 'COMPLETE',
      requestedTypeCount:
        numberValue(rawCompleteness?.requestedTypeCount) ||
        queriedTypes.length ||
        undefined,
      availableTypeCount: numberValue(rawCompleteness?.availableTypeCount),
      unavailableTypeCount:
        numberValue(rawCompleteness?.unavailableTypeCount) ??
        unavailableWorkItemTypes.length,
      unavailableStatisticsCount:
        numberValue(rawCompleteness?.unavailableStatisticsCount) ??
        statisticsUnavailableWorkItemTypes.length,
      unavailableWorkItemTypes,
      unavailableWorkItemTypeNames: firstNonEmptyList(
        stringList(rawCompleteness?.unavailableWorkItemTypeNames),
        errorTypeNames(errors, 'WORK_ITEMS')
      ),
      statisticsUnavailableWorkItemTypes,
      statisticsUnavailableWorkItemTypeNames: firstNonEmptyList(
        stringList(rawCompleteness?.statisticsUnavailableWorkItemTypeNames),
        errorTypeNames(errors, 'STATISTICS')
      ),
    },
  }
}

export function workItemQueryPresentation(
  result: WorkItemsResult,
  completeMessage?: string
): WorkItemQueryPresentation {
  const { status } = result.completeness
  if (status === 'FAILED') {
    return {
      title: '工作项查询未完成',
      badge: '查询失败',
      description: '这次没有从 OA 读到工作项数据。',
      countLabel: '未读取',
      emptyTitle: '暂时无法读取工作项',
      emptyDescription:
        '请稍后重新查询。如果持续失败，请先确认 OA 页面可以正常访问。',
    }
  }

  if (status === 'PARTIAL') {
    const unavailableNames =
      result.completeness.unavailableWorkItemTypeNames.length > 0
        ? result.completeness.unavailableWorkItemTypeNames.join('、')
        : '部分工作项'
    const hasUnavailableLists =
      result.completeness.unavailableWorkItemTypes.length > 0 ||
      result.completeness.unavailableWorkItemTypeNames.length > 0
    const noticeDescription = hasUnavailableLists
      ? `${unavailableNames}暂时未能读取，请稍后重新查询，以免遗漏。`
      : '部分统计信息暂时未能读取，工作项列表仍可查看，建议稍后重试。'

    return {
      title: 'OA 工作项',
      badge: '结果不完整',
      description: result.items.length
        ? `已读取到 ${result.items.length} 项，但本次结果可能不完整。`
        : hasUnavailableLists
          ? '部分工作项暂时未能读取，当前不能确认是否真的没有符合条件的数据。'
          : '工作项列表已读取，但部分统计信息暂时不可用。',
      countLabel: `${result.count} 项`,
      noticeTitle: hasUnavailableLists ? '还有数据未读到' : '部分统计暂不可用',
      noticeDescription,
      emptyTitle: hasUnavailableLists
        ? '暂时不能确认没有工作项'
        : '没有查询到工作项',
      emptyDescription: hasUnavailableLists
        ? '请稍后重新查询，读取完整后再确认。'
        : '当前已读取的工作项列表为空；统计信息可稍后重试。',
    }
  }

  return {
    title: 'OA 工作项',
    badge: '查询完整',
    description: completeMessage || '已读取当前用户可见的工作项。',
    countLabel: `${result.count} 项`,
    emptyTitle: '当前没有符合条件的工作项',
    emptyDescription: '可以调整日期范围或工作项类型后重新查询。',
  }
}

function inferQueryStatus(
  errors: WorkItemQueryError[],
  queriedTypes: string[],
  unavailableTypes: string[]
): WorkItemQueryStatus {
  if (errors.length === 0) return 'COMPLETE'
  if (
    queriedTypes.length > 0 &&
    queriedTypes.every((type) => unavailableTypes.includes(type))
  ) {
    return 'FAILED'
  }
  return 'PARTIAL'
}

function queryStatus(value: unknown): WorkItemQueryStatus | undefined {
  const valueText = text(value)?.toUpperCase()
  if (
    valueText === 'COMPLETE' ||
    valueText === 'PARTIAL' ||
    valueText === 'FAILED'
  ) {
    return valueText
  }
  return undefined
}

function errorTypes(errors: WorkItemQueryError[], scope: string) {
  return unique(
    errors
      .filter((error) => error.scope === scope)
      .map((error) => error.type)
      .filter((value): value is string => Boolean(value))
  )
}

function errorTypeNames(errors: WorkItemQueryError[], scope: string) {
  return unique(
    errors
      .filter((error) => error.scope === scope)
      .map((error) => error.typeName)
      .filter((value): value is string => Boolean(value))
  )
}

function firstNonEmptyList(first: string[], fallback: string[]) {
  return first.length ? first : fallback
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item))
    .filter((item): item is string => Boolean(item))
}

function recordList(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.filter(isRecord)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown) {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized || undefined
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}
