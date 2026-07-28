export function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readRecordList(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.filter(isRecord)
}

export function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

export function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function readText(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

export function stringList(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value]
  return Array.from(
    new Set(
      values
        .map((item) => readText(item)?.trim())
        .filter((item): item is string => Boolean(item))
    )
  )
}

export function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits,
  }).format(value)
}

export function formatDateRange(value?: Record<string, unknown>) {
  if (!value) return ''
  const begin = readText(value.beginDate) || readText(value.startDate)
  const end = readText(value.endDate)
  if (begin && end && begin !== end)
    return `${formatDateText(begin)} 至 ${formatDateText(end)}`
  return formatDateText(begin || end || '')
}

export function formatDateText(value: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

export function formatWorkItemType(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === 'task') return '任务'
  if (normalized === 'requirement' || normalized === 'req') return '需求'
  if (normalized === 'bug') return '缺陷'
  return value
}

export function formatDisplayValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  const text = readText(value)
  if (text) return text
  if (Array.isArray(value)) return `${value.length} 项`
  if (isRecord(value)) return JSON.stringify(value)
  return '-'
}
