import type { AgentTaskViewState } from './oa-public-events.ts'

export type UnderstandingFieldStatus =
  '已明确' | '会话推断' | '系统验证' | '需要确认'

export type UnderstandingField = {
  name: string
  label: string
  valueSummary: string | null
  source: string | null
  status: UnderstandingFieldStatus
  editable: boolean
}

export type UnderstandingCardModel = {
  operation: string
  fields: UnderstandingField[]
  writePreview: boolean
  waitingConfirmation: boolean
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  goal: '操作',
  subject: '人员',
  assigneeName: '人员',
  period: '日期',
  beginDate: '开始日期',
  endDate: '结束日期',
  workDate: '日期',
  projectName: '项目',
  workItemType: '工作项类型',
  workItemTypes: '工作项类型',
  workItemId: '工作项',
  queryKind: '查询类型',
}

const INTENT_LABELS: Readonly<Record<string, string>> = {
  WORK_ITEM_QUERY: '查询工作项',
  USER_WORK_HOUR_QUERY: '查询工时明细',
  WORK_ITEM_DETAIL: '查看工作项详情',
  DAILY_REPORT_STATUS_QUERY: '查询日报状态',
  DAILY_REPORT_DRAFT_UPSERT: '生成日报预览',
  DAILY_REPORT_SUBMIT_PREPARE: '准备提交日报',
  WORK_HOUR_PREPARE: '准备登记工时',
  UNKNOWN: '待确认操作',
}

export function understandingCardModel(
  state: AgentTaskViewState
): UnderstandingCardModel | null {
  if (!state.v2Observed || !state.understanding) return null
  const intentId = state.understanding.selectedIntentId ?? 'UNKNOWN'
  const status = publicFieldStatus(state.understanding.status)
  const fields =
    state.understanding.slots?.map((slot) => ({
      name: slot.name,
      label: slot.label,
      valueSummary: slot.valueSummary,
      source: slot.source,
      status: publicSlotStatus(slot.status),
      editable: slot.editable,
    })) ??
    (state.understanding.fields ?? []).map((name) => ({
      name,
      label: FIELD_LABELS[name] ?? readableFieldName(name),
      valueSummary: null,
      source: null,
      status,
      editable: true,
    }))
  const writePreview =
    intentId.includes('PREPARE') ||
    intentId.includes('DRAFT') ||
    intentId.includes('SUBMIT')
  return {
    operation: INTENT_LABELS[intentId] ?? '处理 OA 任务',
    fields,
    writePreview,
    waitingConfirmation: state.understanding.status === 'WAITING_CONFIRMATION',
  }
}

function publicSlotStatus(status: string): UnderstandingFieldStatus {
  if (status === 'NEEDS_CONFIRMATION' || status === 'CONFLICT')
    return '需要确认'
  if (status === 'GROUNDED') return '系统验证'
  if (status === 'CONTEXT_INFERRED') return '会话推断'
  return '已明确'
}

function publicFieldStatus(
  status: string | undefined
): UnderstandingFieldStatus {
  if (status === 'WAITING_USER' || status === 'WAITING_CONFIRMATION') {
    return '需要确认'
  }
  if (status === 'CONTEXT_INFERRED') return '会话推断'
  if (status === 'VERIFIED' || status === 'COMPLETED') return '系统验证'
  return '已明确'
}

function readableFieldName(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim()
}
