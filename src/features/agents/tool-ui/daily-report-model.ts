import type { MissingWorkHourItem } from '../api'
import {
  dailyReportOperationMode,
  type DailyReportOperationMode,
} from '../daily-report'
import {
  formatNumber,
  formatWorkItemType,
  isRecord,
  numberValue,
  readBoolean,
  readNumber,
  readRecordList,
  readString,
  readText,
  stringList,
} from './shared'
import { readMissingWorkHourItems } from './work-hour-data'

export type OverdueReasonItem = {
  key: string
  type: string
  typeName: string
  id: string
  title?: string
  projectTitle?: string
  process?: string
  status?: string
  overdueDays?: number
}

type DailyReportReadinessItem = {
  code: string
  title: string
  description?: string
  action?: string
  count?: number
}

type DailyReportNextAction = {
  action: string
  label: string
}

type DailyReportReadiness = {
  status: string
  title: string
  description?: string
  blockers: DailyReportReadinessItem[]
  suggestions: DailyReportReadinessItem[]
  nextActions: DailyReportNextAction[]
}

type DailyReportReferenceSource = {
  type: string
  label: string
  count: number
}

export type DailyReportReferences = {
  userContent: string[]
  oaSources: DailyReportReferenceSource[]
}

export type DailyReportDraftResult = {
  draftId?: string
  draftVersion?: number
  workDate?: string
  operationMode: DailyReportOperationMode
  existingReport: boolean
  oaReportId?: string
  status?: string
  submitted?: boolean
  content: string
  remark?: string
  hasStructuredContent: boolean
  taskWork: Record<string, unknown>[]
  bugWork: Record<string, unknown>[]
  totalRegisteredWorkHours?: number
  tomorrowWorkPlan: Record<string, unknown>[]
  unresolvedProblem: Record<string, unknown>[]
  unresolvedRisk: Record<string, unknown>[]
  overdueReasons?: Record<string, string>
  validationErrors: string[]
  validationWarnings: string[]
  overdueReasonItems: OverdueReasonItem[]
  missingWorkHourItems: MissingWorkHourItem[]
  readiness: DailyReportReadiness
  references: DailyReportReferences
  requiresOverdueReasons: boolean
  submitReady: boolean
  requiresConfirmation: boolean
  confirmEndpoint?: string
  idempotencyKey?: string
  confirmationContext?: Record<string, unknown>
}

export type DailyReportSectionKind =
  'tasks' | 'bugs' | 'problems' | 'risks' | 'plan' | 'other'

export type DailyReportLine = {
  id: string
  text: string
  body: string
  rawId?: string
  workItemType?: string
  project?: string
  title: string
  detail?: string
  progress?: number
  personalProgress?: number
  status?: string
  hours?: string
  overdueDays?: number
  executionText?: string
  summary?: boolean
}

export type DailyReportSection = {
  id: string
  title: string
  kind: DailyReportSectionKind
  items: DailyReportLine[]
}

type DailyReportContent = {
  title?: string
  sections: DailyReportSection[]
}

export type OverdueLineMatches = {
  byLineId: Map<string, OverdueReasonItem>
  matchedKeys: Set<string>
}

export function dailyReportWorkHourStats(draft: DailyReportDraftResult) {
  const task = sumDailyReportWorkHours(draft.taskWork)
  const bug = sumDailyReportWorkHours(draft.bugWork)
  return {
    task,
    bug,
    total: draft.totalRegisteredWorkHours ?? task + bug,
  }
}

function sumDailyReportWorkHours(records: Record<string, unknown>[]) {
  return records.reduce((total, record) => {
    const value = firstRecordValue(
      record,
      'totalWorkHours',
      'actualWorkHours',
      'workHours'
    )
    return total + workHourNumberFromValue(value)
  }, 0)
}

function workHourNumberFromValue(value: unknown) {
  const numeric = numberValue(value)
  if (numeric !== undefined) return numeric
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/u)
    if (match) {
      const parsed = Number(match[0])
      return Number.isFinite(parsed) ? parsed : 0
    }
  }
  return 0
}

export function dailyReportContentFromDraft(
  draft: DailyReportDraftResult
): DailyReportContent | undefined {
  if (!draft.hasStructuredContent) return undefined

  const tomorrow = nextDateText(draft.workDate)
  return {
    title: draft.workDate
      ? `${draft.workDate} 工作日报${draft.operationMode === 'update' ? '' : '草稿'}`
      : draft.operationMode === 'update'
        ? '工作日报'
        : '工作日报草稿',
    sections: [
      dailyReportStructuredSection(
        'tasks',
        '今日任务',
        draft.taskWork,
        (record, index) => dailyReportWorkLine(record, 'tasks', 'task', index)
      ),
      dailyReportStructuredSection(
        'bugs',
        '今日缺陷',
        draft.bugWork,
        (record, index) => dailyReportWorkLine(record, 'bugs', 'bug', index)
      ),
      dailyReportStructuredSection(
        'problems',
        '待解决问题',
        draft.unresolvedProblem,
        (record, index) => dailyReportIssueLine(record, 'problems', index)
      ),
      dailyReportStructuredSection(
        'risks',
        '待解决风险',
        draft.unresolvedRisk,
        (record, index) => dailyReportIssueLine(record, 'risks', index)
      ),
      dailyReportStructuredSection(
        'plan',
        tomorrow ? `${tomorrow} 明日计划` : '明日工作计划',
        draft.tomorrowWorkPlan,
        (record, index) => dailyReportWorkLine(record, 'plan', 'task', index)
      ),
    ],
  }
}

function dailyReportStructuredSection(
  kind: DailyReportSectionKind,
  title: string,
  records: Record<string, unknown>[],
  mapRecord: (record: Record<string, unknown>, index: number) => DailyReportLine
): DailyReportSection {
  return {
    id: `${kind}-structured`,
    title,
    kind,
    items: records.map(mapRecord),
  }
}

function dailyReportWorkLine(
  record: Record<string, unknown>,
  kind: DailyReportSectionKind,
  workItemType: 'task' | 'bug',
  index: number
): DailyReportLine {
  const rawId = readRecordText(record, 'id', 'rawId')
  const project = readRecordText(record, 'projectTitle', 'projectName')
  const title = readRecordText(record, 'title', 'name') || '未命名工作项'
  const status = readRecordText(record, 'status', 'statusName')
  const executionDesc = readRecordText(record, 'executionDesc', 'overdueReason')

  return {
    id: dailyReportRecordLineId(kind, record, index, workItemType),
    text: dailyReportLineText(project, title),
    body: dailyReportLineText(project, title),
    rawId,
    workItemType,
    project,
    title,
    progress: readRecordPercent(record, 'process', 'progress'),
    personalProgress:
      kind === 'tasks'
        ? readRecordPercent(record, 'personalProgress')
        : undefined,
    status,
    hours: dailyReportHoursText(record),
    overdueDays: readRecordNumber(record, 'overdueDays'),
    executionText: executionDesc,
  }
}

function dailyReportIssueLine(
  record: Record<string, unknown>,
  kind: DailyReportSectionKind,
  index: number
): DailyReportLine {
  const project = readRecordText(record, 'projectTitle', 'projectName')
  const title = readRecordText(record, 'title', 'name') || '未命名事项'
  const status = readRecordText(record, 'status', 'statusName')
  const measure =
    kind === 'risks'
      ? readRecordText(record, 'treatmentMeasures')
      : readRecordText(record, 'correctionMeasures')
  const riskValue = kind === 'risks' ? readRecordText(record, 'riskValue') : ''
  const planEndDate = readRecordText(record, 'planEndDate')
  const detailParts = [
    measure,
    riskValue ? `风险值 ${riskValue}` : '',
    planEndDate ? `计划解决 ${planEndDate}` : '',
  ].filter(Boolean)

  return {
    id: dailyReportRecordLineId(kind, record, index),
    text: dailyReportLineText(project, title),
    body: dailyReportLineText(project, title),
    rawId: readRecordText(record, 'id', 'rawId'),
    project,
    title,
    detail: detailParts.length ? detailParts.join(' · ') : undefined,
    status,
  }
}

function dailyReportRecordLineId(
  kind: DailyReportSectionKind,
  record: Record<string, unknown>,
  index: number,
  workItemType?: string
) {
  const rawId = readRecordText(record, 'id', 'rawId')
  if (rawId) return `${kind}-${workItemType || 'item'}-${rawId}`
  return `${kind}-${index}-${normalizeDailyReportText(
    readRecordText(record, 'title', 'name')
  ).slice(0, 24)}`
}

function dailyReportLineText(project: string, title: string) {
  return project ? `【${project}】${title}` : title
}

function dailyReportHoursText(record: Record<string, unknown>) {
  const value = firstRecordValue(
    record,
    'totalWorkHours',
    'actualWorkHours',
    'workHours'
  )
  if (value === undefined) return undefined
  const numeric = numberValue(value)
  if (numeric !== undefined) {
    return `${formatNumber(numeric)}h`
  }
  const text = readText(value)?.trim()
  if (!text) return undefined
  return text.replace(/^耗时\s*/u, '')
}

function readRecordText(record: Record<string, unknown>, ...fields: string[]) {
  const value = firstRecordValue(record, ...fields)
  return readText(value)?.trim() ?? ''
}

function readRecordNumber(
  record: Record<string, unknown>,
  ...fields: string[]
) {
  const value = firstRecordValue(record, ...fields)
  return value === undefined ? undefined : numberValue(value)
}

function readRecordPercent(
  record: Record<string, unknown>,
  ...fields: string[]
) {
  const value = firstRecordValue(record, ...fields)
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/u)
    if (!match) return undefined
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return numberValue(value)
}

function firstRecordValue(
  record: Record<string, unknown>,
  ...fields: string[]
) {
  for (const field of fields) {
    const value = record[field]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return undefined
}

function nextDateText(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/u)
  if (!match) return ''
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )
  date.setDate(date.getDate() + 1)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function parseDailyReportContent(content: string): DailyReportContent {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const sections: DailyReportSection[] = []
  let title: string | undefined
  let current: DailyReportSection | undefined

  for (const line of lines) {
    const header = parseDailyReportSectionHeader(line)
    if (header) {
      current = {
        id: `${header.kind}-${sections.length}`,
        title: header.title,
        kind: header.kind,
        items: [],
      }
      sections.push(current)
      if (header.inlineText) {
        current.items.push(
          parseDailyReportLine(header.inlineText, current.kind, 0)
        )
      }
      continue
    }

    if (!title && line.includes('日报')) {
      title = line
      continue
    }

    if (!current) {
      current = {
        id: `other-${sections.length}`,
        title: '其他内容',
        kind: 'other',
        items: [],
      }
      sections.push(current)
    }

    current.items.push(
      parseDailyReportLine(line, current.kind, current.items.length)
    )
  }

  return { title, sections }
}

function parseDailyReportSectionHeader(line: string):
  | {
      kind: DailyReportSectionKind
      title: string
      inlineText?: string
    }
  | undefined {
  const definitions: Array<{
    kind: DailyReportSectionKind
    pattern: RegExp
    title?: string
  }> = [
    { kind: 'tasks', pattern: /^今日任务[：:]\s*(.*)$/u, title: '今日任务' },
    { kind: 'bugs', pattern: /^今日缺陷[：:]\s*(.*)$/u, title: '今日缺陷' },
    {
      kind: 'problems',
      pattern: /^待解决问题[：:]\s*(.*)$/u,
      title: '待解决问题',
    },
    {
      kind: 'risks',
      pattern: /^待解决风险[：:]\s*(.*)$/u,
      title: '待解决风险',
    },
    { kind: 'plan', pattern: /^(.*明日计划)[：:]\s*(.*)$/u },
  ]

  for (const definition of definitions) {
    const match = line.match(definition.pattern)
    if (!match) continue
    const title =
      definition.title ||
      match[1]?.trim() ||
      dailyReportKindTitle(definition.kind)
    const inlineText = (definition.title ? match[1] : match[2])?.trim()
    return {
      kind: definition.kind,
      title,
      inlineText,
    }
  }

  return undefined
}

function dailyReportKindTitle(kind: DailyReportSectionKind) {
  switch (kind) {
    case 'tasks':
      return '今日任务'
    case 'bugs':
      return '今日缺陷'
    case 'problems':
      return '待解决问题'
    case 'risks':
      return '待解决风险'
    case 'plan':
      return '明日计划'
    default:
      return '其他内容'
  }
}

function parseDailyReportLine(
  rawLine: string,
  kind: DailyReportSectionKind,
  index: number
): DailyReportLine {
  const body = rawLine.replace(/^\d+[.、]\s*/u, '').trim()
  const summary = body === '暂无' || /^(\.\.\.|…)/u.test(body)
  let project: string | undefined
  let title = body

  const projectMatch = body.match(/^【([^】]+)】\s*(.*)$/u)
  const content = projectMatch ? projectMatch[2].trim() : body
  if (projectMatch) {
    project = projectMatch[1].trim()
    title = content
  }

  const detailMatch =
    content.match(/^(.*?)（(.*)）$/u) || content.match(/^(.*?)\((.*)\)$/u)
  let rawDetail: string | undefined
  if (detailMatch) {
    title = detailMatch[1].trim() || content
    rawDetail = detailMatch[2].trim()
  }

  const sourceForMeta = rawDetail || body
  const status = extractDailyReportStatus(sourceForMeta)
  const detail = visibleDailyReportDetail(rawDetail, status)

  return {
    id: `${kind}-${index}-${normalizeDailyReportText(rawLine).slice(0, 24)}`,
    text: rawLine,
    body,
    project,
    title: title || body,
    detail,
    progress: extractDailyReportProgress(sourceForMeta),
    status,
    hours: extractDailyReportHours(sourceForMeta),
    executionText: detail,
    summary,
  }
}

function extractDailyReportProgress(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)%/u)
  if (!match) return undefined
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

function extractDailyReportHours(value: string) {
  const match = value.match(/耗时\s*(\d+(?:\.\d+)?\s*(?:h|小时)?)/iu)
  if (!match) return undefined
  const text = match[1].replace(/\s/g, '')
  return /(?:h|小时)$/iu.test(text) ? text : `${text}h`
}

function extractDailyReportStatus(value: string) {
  const parts = value
    .split(/[，,]/u)
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.find(
    (part) => !/^\d+(?:\.\d+)?%$/u.test(part) && !part.includes('耗时')
  )
}

function visibleDailyReportDetail(value: string | undefined, status?: string) {
  if (!value) return undefined
  const parts = value
    .replace(/^[，,\s]+/u, '')
    .split(/[，,]/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      if (/^\d+(?:\.\d+)?%$/u.test(part)) return false
      if (part.includes('耗时')) return false
      return !status || part !== status
    })

  return parts.length ? parts.join('，') : undefined
}

export function dailyReportItemCount(sections: DailyReportSection[]) {
  return sections.reduce((count, section) => {
    return (
      count +
      section.items.reduce((sectionCount, item) => {
        const extra = item.text.match(/还有\s*(\d+)\s*项/u)
        if (extra) return sectionCount + Number(extra[1])
        return sectionCount + (item.summary ? 0 : 1)
      }, 0)
    )
  }, 0)
}

export function matchOverdueReasonItems(
  sections: DailyReportSection[],
  items: OverdueReasonItem[]
): OverdueLineMatches {
  const byLineId = new Map<string, OverdueReasonItem>()
  const matchedKeys = new Set<string>()

  for (const section of sections) {
    for (const line of section.items) {
      const match = items.find(
        (item) =>
          !matchedKeys.has(item.key) &&
          dailyReportLineMatchesOverdueItem(section.kind, line, item)
      )
      if (!match) continue
      byLineId.set(line.id, match)
      matchedKeys.add(match.key)
    }
  }

  return { byLineId, matchedKeys }
}

export function dailyReportLineWorkItemKey(
  line: DailyReportLine,
  kind: DailyReportSectionKind
) {
  if (!line.rawId) return undefined
  const type =
    line.workItemType ||
    (kind === 'tasks' ? 'task' : kind === 'bugs' ? 'bug' : undefined)
  if (type !== 'task' && type !== 'bug') return undefined
  return `${type}:${line.rawId}`
}

export function isEditableDailyReportWorkText(
  line: DailyReportLine,
  kind: DailyReportSectionKind,
  overdueItem?: OverdueReasonItem
) {
  if (kind !== 'tasks' && kind !== 'bugs') return false
  if (overdueItem) return true
  return (
    line.overdueDays !== undefined &&
    line.overdueDays > 0 &&
    workHourNumberFromValue(line.hours) <= 0
  )
}

function dailyReportLineMatchesOverdueItem(
  kind: DailyReportSectionKind,
  line: DailyReportLine,
  item: OverdueReasonItem
) {
  if (line.summary) return false
  if (kind === 'tasks' && item.type.toLowerCase() !== 'task') return false
  if (kind === 'bugs' && item.type.toLowerCase() !== 'bug') return false
  if (kind !== 'tasks' && kind !== 'bugs') return false

  if (
    line.rawId &&
    line.workItemType &&
    line.workItemType.toLowerCase() === item.type.toLowerCase() &&
    String(line.rawId) === item.id
  ) {
    return true
  }

  const itemTitle = normalizeDailyReportText(item.title || '')
  const lineTitle = normalizeDailyReportText(line.title)
  if (!itemTitle || itemTitle !== lineTitle) return false

  const itemProject = normalizeDailyReportText(item.projectTitle || '')
  const lineProject = normalizeDailyReportText(line.project || '')
  return !itemProject || !lineProject || itemProject === lineProject
}

function normalizeDailyReportText(value: string) {
  return value.replace(/[\s【】（）()，,。；;:：]/gu, '').toLowerCase()
}

export function parseDailyReportDraftResult(
  result: Record<string, unknown> | undefined
): DailyReportDraftResult | undefined {
  if (!result) return undefined
  const content = readString(result.content)

  const validationErrors = stringList(result.validationErrors)
  const validationWarnings = stringList(result.validationWarnings).filter(
    (item) => !validationErrors.includes(item)
  )
  const submitReady =
    readBoolean(result.submitReady) ?? validationErrors.length === 0
  const overdueReasonItems = readOverdueReasonItems(result.overdueReasonItems)
  const missingWorkHourItems = readMissingWorkHourItems(
    result.missingWorkHourItems
  )
  const taskWork = readRecordList(result.taskWork)
  const bugWork = readRecordList(result.bugWork)
  const tomorrowWorkPlan = readRecordList(result.tomorrowWorkPlan)
  const unresolvedProblem = readRecordList(result.unresolvedProblem)
  const unresolvedRisk = readRecordList(result.unresolvedRisk)
  const readiness = readDailyReportReadiness(
    result.readiness,
    validationErrors,
    validationWarnings,
    submitReady,
    overdueReasonItems,
    missingWorkHourItems
  )
  const references = readDailyReportReferences(
    result.references,
    result.sourceData
  )
  const totalRegisteredWorkHours = readTotalRegisteredWorkHours(result)
  const oaReportId = readString(result.oaReportId)
  const operationMode = dailyReportOperationMode(
    result.operationMode,
    readBoolean(result.existingReport) === true || Boolean(oaReportId)
  )
  const existingReport =
    readBoolean(result.existingReport) === true || operationMode === 'update'
  const hasStructuredContent = Boolean(
    taskWork ||
    bugWork ||
    tomorrowWorkPlan ||
    unresolvedProblem ||
    unresolvedRisk
  )
  if (
    !content &&
    !readString(result.draftId) &&
    !hasStructuredContent &&
    validationErrors.length === 0 &&
    missingWorkHourItems.length === 0
  ) {
    return undefined
  }

  return {
    draftId: readString(result.draftId),
    draftVersion: readNumber(result.draftVersion),
    workDate: readString(result.workDate),
    operationMode,
    existingReport,
    oaReportId,
    status: readString(result.status),
    submitted: readBoolean(result.submitted),
    content: content || '',
    remark: readString(result.remark),
    hasStructuredContent,
    taskWork: taskWork ?? [],
    bugWork: bugWork ?? [],
    totalRegisteredWorkHours,
    tomorrowWorkPlan: tomorrowWorkPlan ?? [],
    unresolvedProblem: unresolvedProblem ?? [],
    unresolvedRisk: unresolvedRisk ?? [],
    overdueReasons: readStringRecord(result.overdueReasons),
    validationErrors,
    validationWarnings,
    overdueReasonItems,
    missingWorkHourItems,
    readiness,
    references,
    requiresOverdueReasons:
      readBoolean(result.requiresOverdueReasons) ??
      overdueReasonItems.length > 0,
    submitReady,
    requiresConfirmation:
      readBoolean(result.requiresConfirmation) ?? submitReady,
    confirmEndpoint: readString(result.confirmEndpoint),
    idempotencyKey: readString(result.idempotencyKey),
    confirmationContext: isRecord(result.confirmationContext)
      ? result.confirmationContext
      : undefined,
  }
}

function readTotalRegisteredWorkHours(result: Record<string, unknown>) {
  const directValue = firstRecordValue(
    result,
    'totalRegisteredWorkHours',
    'registeredWorkHours',
    'totalWorkHours'
  )
  const direct = directValue === undefined ? undefined : numberValue(directValue)
  if (direct !== undefined) return direct

  if (isRecord(result.workHourStats)) {
    const statsValue = firstRecordValue(
      result.workHourStats,
      'totalRegistered',
      'total',
      'registered'
    )
    const stats =
      statsValue === undefined ? undefined : numberValue(statsValue)
    if (stats !== undefined) return stats
  }

  if (isRecord(result.sourceData) && isRecord(result.sourceData.workHours)) {
    const sourceValue = firstRecordValue(
      result.sourceData.workHours,
      'totalRegistered',
      'total',
      'registered'
    )
    return sourceValue === undefined ? undefined : numberValue(sourceValue)
  }

  return undefined
}

function readDailyReportReadiness(
  value: unknown,
  validationErrors: string[],
  validationWarnings: string[],
  submitReady: boolean,
  overdueReasonItems: OverdueReasonItem[],
  missingWorkHourItems: MissingWorkHourItem[]
): DailyReportReadiness {
  if (isRecord(value)) {
    const blockers = readDailyReportReadinessItems(value.blockers)
    const suggestions = readDailyReportReadinessItems(value.suggestions)
    return {
      status:
        readString(value.status) ||
        (blockers.length
          ? 'ACTION_REQUIRED'
          : submitReady
            ? 'READY'
            : 'PENDING'),
      title:
        readString(value.title) || (blockers[0]?.title ?? '日报草稿已整理好'),
      description: readString(value.description),
      blockers,
      suggestions,
      nextActions: readDailyReportNextActions(value.nextActions),
    }
  }

  const blockers: DailyReportReadinessItem[] = []
  if (
    missingWorkHourItems.length ||
    validationErrors.some(isMissingWorkHoursValidation)
  ) {
    blockers.push({
      code: 'MISSING_WORK_HOURS',
      title: '今天还没有有效工时',
      description: '请先为一项任务或缺陷登记工时，保存后再重新生成日报。',
      action: 'FILL_WORK_HOURS',
      count: missingWorkHourItems.length || undefined,
    })
  } else if (validationErrors.length) {
    blockers.push({
      code: 'MISSING_REQUIRED_DATA',
      title: '日报还缺少必要信息',
      description: validationErrors.join('；'),
    })
  }
  if (overdueReasonItems.length) {
    blockers.push({
      code: 'MISSING_OVERDUE_REASONS',
      title: `还有 ${overdueReasonItems.length} 项逾期原因待补充`,
      description: '请在对应任务或缺陷下填写原因，补齐后即可提交。',
      action: 'FILL_OVERDUE_REASONS',
      count: overdueReasonItems.length,
    })
  }
  const suggestions = validationWarnings.map((description, index) => ({
    code: `SUGGESTION_${index + 1}`,
    title: '建议完善日报内容',
    description,
  }))
  return {
    status: blockers.length
      ? 'ACTION_REQUIRED'
      : submitReady
        ? 'READY'
        : 'PENDING',
    title: blockers[0]?.title || '日报草稿已整理好',
    blockers,
    suggestions,
    nextActions: [],
  }
}

function readDailyReportReadinessItems(
  value: unknown
): DailyReportReadinessItem[] {
  return (readRecordList(value) ?? []).map((item, index) => ({
    code: readString(item.code) || `ITEM_${index + 1}`,
    title: readString(item.title) || '还有信息待补充',
    description: readString(item.description),
    action: readString(item.action),
    count: readNumber(item.count),
  }))
}

function readDailyReportNextActions(value: unknown): DailyReportNextAction[] {
  return (readRecordList(value) ?? [])
    .map((item): DailyReportNextAction | undefined => {
      const action = readString(item.action)
      const label = readString(item.label)
      return action && label ? { action, label } : undefined
    })
    .filter((item): item is DailyReportNextAction => Boolean(item))
}

function readDailyReportReferences(
  value: unknown,
  sourceData: unknown
): DailyReportReferences {
  if (isRecord(value)) {
    return {
      userContent: stringList(value.userContent),
      oaSources: (readRecordList(value.oaSources) ?? [])
        .map((item): DailyReportReferenceSource | undefined => {
          const type = readString(item.type)
          const label = readString(item.label)
          const count = readNumber(item.count)
          return type && label && count !== undefined
            ? { type, label, count }
            : undefined
        })
        .filter((item): item is DailyReportReferenceSource => Boolean(item)),
    }
  }

  const counts =
    isRecord(sourceData) && isRecord(sourceData.counts)
      ? sourceData.counts
      : undefined
  if (!counts) return { userContent: [], oaSources: [] }
  const sourceDefinitions = [
    ['taskWork', 'TODAY_TASKS', '今日任务'],
    ['bugWork', 'TODAY_BUGS', '今日缺陷'],
    ['tomorrowTaskPlan', 'TOMORROW_PLAN', '明日计划'],
    ['unresolvedProblems', 'OPEN_PROBLEMS', '待解决问题'],
    ['unresolvedRisks', 'OPEN_RISKS', '待解决风险'],
  ] as const
  return {
    userContent: [],
    oaSources: sourceDefinitions.map(([key, type, label]) => ({
      type,
      label,
      count: readNumber(counts[key]) ?? 0,
    })),
  }
}

function readOverdueReasonItems(value: unknown): OverdueReasonItem[] {
  return (readRecordList(value) ?? [])
    .map((item): OverdueReasonItem | undefined => {
      const id = readText(item.id)
      const type = readString(item.type) || 'workItem'
      const key = readText(item.key) || (id ? type + ':' + id : '')
      if (!id || !key) return undefined
      return {
        key,
        type,
        typeName: readString(item.typeName) || formatWorkItemType(type),
        id,
        title: readString(item.title),
        projectTitle: readString(item.projectTitle),
        process: readString(item.process),
        status: readString(item.status),
        overdueDays: readNumber(item.overdueDays),
      }
    })
    .filter((item): item is OverdueReasonItem => Boolean(item))
}

export function initialOverdueReasons(
  items: OverdueReasonItem[],
  storedReasons: Record<string, string> = {}
) {
  return Object.fromEntries(
    items.map((item) => [item.key, storedReasons[item.key] ?? ''])
  )
}

export function mergeOverdueReasons(
  items: OverdueReasonItem[],
  currentReasons: Record<string, string>,
  storedReasons: Record<string, string> = {}
) {
  const next = initialOverdueReasons(items, storedReasons)
  for (const [key, value] of Object.entries(currentReasons)) {
    const current = value.trim()
    if (current) {
      next[key] = value
    }
  }
  return next
}

export function compactStringMap(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => Boolean(value))
  )
}

export function readStringRecord(value: unknown) {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child]) => [key, readText(child)?.trim() ?? ''] as const)
      .filter(([, child]) => Boolean(child))
  )
}

export function overdueReasonTitle(item: OverdueReasonItem) {
  return item.title || item.typeName + ' ' + item.id
}

function isMissingWorkHoursValidation(message: string) {
  const normalized = message.replace(/\s/g, '')
  return (
    normalized.includes('必要工时') ||
    normalized.includes('工时信息') ||
    normalized.includes('workHours')
  )
}

export function isDailyReportMissingWorkHours(draft: DailyReportDraftResult) {
  return [...draft.validationErrors, ...draft.validationWarnings].some(
    isMissingWorkHoursValidation
  )
}
