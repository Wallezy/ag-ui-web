import type {
  ThreadAssistantMessagePart,
  ThreadMessage,
} from '@assistant-ui/react'
import type { AgentId, ConversationSummary } from './types'

const AGUI_WEATHER_ENDPOINT = '/api/agent/ag-ui'

const API_BASE_URL = import.meta.env.VITE_AGENT_API_BASE_URL ?? ''

const DEFAULT_OA_LOGIN_URL = '/app/admin/'

export const OA_LOGIN_URL =
  import.meta.env.VITE_OA_LOGIN_URL ?? DEFAULT_OA_LOGIN_URL

const OA_LOGIN_REDIRECT_PARAM =
  import.meta.env.VITE_OA_LOGIN_REDIRECT_PARAM ?? ''

export const AGUI_RUN_URL =
  import.meta.env.VITE_AGUI_WEATHER_URL ??
  `${API_BASE_URL}${AGUI_WEATHER_ENDPOINT}`

const CONVERSATION_AGENT_STORAGE_KEY = 'agent-platform:conversation-agents'

type BackendConversationSummary = {
  id: string
  title: string
  status: string
  updatedAt: number | string
  ownerId: string
  tenantId: string
}

type StoredChatMessage = {
  id: string
  role: string
  content: string
  createdAt: number | string
}

type ConversationTimelineEntry = {
  id: string
  kind: 'user_message' | 'agui_event'
  timestamp: number | string
  message?: StoredChatMessage | null
  event?: Record<string, unknown> | null
}

type ConversationDetail = {
  summary: BackendConversationSummary
  timeline: ConversationTimelineEntry[]
}

type ConversationListResponse = {
  conversations: BackendConversationSummary[]
}

type CreateConversationResponse = {
  conversation: BackendConversationSummary
}

type ClearConversationsResponse = {
  deletedCount: number
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

type JsonObject = { readonly [key: string]: JsonValue }

export type OaSessionStatus = {
  authenticated: boolean
  username?: string
  tenantId?: string
  message?: string
  errorCode?: string
  loginUrl?: string
}

export type DailyReportConfirmationRequest = {
  action: 'CONFIRM' | 'ALLOW' | 'DENY' | 'REJECT'
  agentId?: string
  runId?: string
  traceId?: string
  draftId: string
  draftVersion?: number
  idempotencyKey?: string
  confirmedContent?: string
  overdueReasons?: Record<string, string>
  confirmationContext?: Record<string, unknown>
}

export type DailyReportConfirmationResponse = {
  status: string
  toolName?: string
  draftId?: string
  auditId?: string
  errorCode?: string
  message?: string
  result?: Record<string, unknown>
}

export type DailyReportDraftStatusResponse = {
  draftId: string
  draftVersion?: number
  workDate?: string
  status: string
  submitted?: boolean
  submitReady?: boolean
  requiresConfirmation?: boolean
  remark?: string
  overdueReasons?: Record<string, string>
  result?: Record<string, unknown>
  message?: string
}

export type MissingWorkHourItem = {
  key: string
  type: 'task' | 'bug'
  typeName: string
  id: string
  title?: string
  projectTitle?: string
  projectId?: string
  process?: string
  status?: string
  workDate?: string
  currentWorkHour?: number
  progress?: number
  overdueDays?: number
  canQuickFill?: boolean
  reason?: string
}

export type WorkHourOption = {
  value: string
  label: string
  disabled?: boolean
}

export type WorkHourOptionsResponse = {
  type: 'task' | 'bug'
  workItemId: string
  workDate: string
  item?: Record<string, unknown>
  canExecute?: boolean
  workCategories: WorkHourOption[]
  defaultWorkCategory?: string
  userWorkHours: Record<string, unknown>[]
  hiddenWorkHours: Record<string, unknown>[]
  evidences: Record<string, unknown>[]
  projectBases: Record<string, unknown>[]
  designs: Record<string, unknown>[]
}

export type SaveWorkHourExecutionRequest = {
  type: 'task' | 'bug'
  workItemId: string
  workDate: string
  workCategory: string
  workHour: number
  progress: number
  executionDesc?: string
  description?: string
  evidences?: Record<string, unknown>[]
  confirmationContext?: Record<string, unknown>
}

export type SaveWorkHourExecutionResponse = {
  status: string
  toolName?: string
  auditId?: string
  errorCode?: string
  message?: string
  result?: Record<string, unknown>
}

export type AgentConfig = {
  id: AgentId
  backendAgentId: string
  label: string
  shortLabel: string
  description: string
  emptyTitle: string
  emptyMessage: string
  newConversationTitle: string
  badge: string
}

const agentConfigs: AgentConfig[] = [
  {
    id: 'weatherAgent',
    backendAgentId: 'weather-agent',
    label: '天气智能体',
    shortLabel: '天气',
    description: '实时天气、通勤和户外建议',
    emptyTitle: '新的天气会话',
    emptyMessage: '询问城市天气、体感温度、湿度和出行建议。',
    newConversationTitle: '新的天气会话',
    badge: 'Weather Agent',
  },
  {
    id: 'projectManagerAgent',
    backendAgentId: 'oa-agent',
    label: '项目管理智能体',
    shortLabel: '项目管理',
    description: '工作项查询、项目进展和日报草稿',
    emptyTitle: '新的项目管理会话',
    emptyMessage: '查询工作项、项目进展、风险和日报草稿。',
    newConversationTitle: '新的项目管理会话',
    badge: 'OA Agent',
  },
]

const defaultAgent = agentConfigs[0]

export function agentById(agentId: AgentId) {
  return agentConfigs.find((agent) => agent.id === agentId) ?? defaultAgent
}

function rememberConversationAgent(conversationId: string, agentId: AgentId) {
  const next = {
    ...readConversationAgentMap(),
    [conversationId]: agentId,
  }
  window.localStorage.setItem(
    CONVERSATION_AGENT_STORAGE_KEY,
    JSON.stringify(next)
  )
}

export async function listConversations() {
  const payload = await request<ConversationListResponse>(
    '/api/agent/conversations'
  )
  return payload.conversations.map(toConversationSummary)
}

export async function createConversation(agent: AgentConfig) {
  const conversationId = `thread-web-${agent.id}-${createClientId()}`
  rememberConversationAgent(conversationId, agent.id)

  try {
    const payload = await request<CreateConversationResponse>(
      '/api/agent/conversations',
      {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          title: agent.newConversationTitle,
        }),
      }
    )
    rememberConversationAgent(payload.conversation.id, agent.id)
    return toConversationSummary(payload.conversation)
  } catch {
    return toLocalConversationSummary(conversationId, agent)
  }
}

export async function clearConversations() {
  const payload = await request<ClearConversationsResponse>(
    '/api/agent/conversations',
    {
      method: 'DELETE',
    }
  )
  clearRememberedConversationAgents()
  return payload.deletedCount
}

export async function loadConversationMessages(conversationId: string) {
  if (!conversationId) return []
  try {
    const detail = await request<ConversationDetail>(
      `/api/agent/conversations/${encodeURIComponent(conversationId)}`
    )
    return timelineToThreadMessages(detail.timeline)
  } catch {
    return []
  }
}

export async function checkOaSession(authContext?: Record<string, unknown>) {
  return request<OaSessionStatus>('/api/agent/oa/session', {
    method: 'POST',
    body: JSON.stringify(authContext ? { authContext } : {}),
  })
}

export async function confirmDailyReport(
  payload: DailyReportConfirmationRequest,
  endpoint = '/api/agent/confirm'
) {
  return request<DailyReportConfirmationResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getDailyReportDraftStatus(draftId: string) {
  return request<DailyReportDraftStatusResponse>(
    `/api/agent/daily-report-drafts/${encodeURIComponent(draftId)}`
  )
}

export async function getWorkHourOptions(
  item: Pick<MissingWorkHourItem, 'type' | 'id' | 'workDate' | 'projectId'>,
  fallbackWorkDate?: string
) {
  const params = new URLSearchParams({
    type: item.type,
    workItemId: item.id,
  })
  if (item.workDate || fallbackWorkDate) {
    params.set('workDate', item.workDate || fallbackWorkDate || '')
  }
  if (item.projectId) {
    params.set('projectId', item.projectId)
  }
  return request<WorkHourOptionsResponse>(
    `/api/agent/oa/work-hours/options?${params.toString()}`
  )
}

export async function saveWorkHourExecution(
  payload: SaveWorkHourExecutionRequest
) {
  return request<SaveWorkHourExecutionResponse>('/api/agent/oa/work-hours', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function buildOaLoginUrl(returnTo = window.location.href) {
  const loginUrl = new URL(OA_LOGIN_URL, window.location.origin)

  if (OA_LOGIN_REDIRECT_PARAM) {
    loginUrl.searchParams.set(OA_LOGIN_REDIRECT_PARAM, returnTo)
  }

  return loginUrl.toString()
}

export function redirectToOaLogin(returnTo?: string) {
  window.location.assign(buildOaLoginUrl(returnTo))
}

export async function apiFetch(url: string, requestInit: RequestInit) {
  const response = await fetch(url, {
    ...requestInit,
    credentials: 'include',
  })

  if (response.status === 401) {
    redirectToOaLogin()
  }

  return response
}

function toConversationSummary(
  conversation: BackendConversationSummary
): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    lastMessage: statusLabel(conversation.status),
    updatedAt: formatRelativeTime(conversation.updatedAt),
    agentId: agentForConversation(conversation),
    status: conversation.status,
  }
}

function toLocalConversationSummary(
  conversationId: string,
  agent: AgentConfig
): ConversationSummary {
  return {
    id: conversationId,
    title: agent.newConversationTitle,
    lastMessage: statusLabel('idle'),
    updatedAt: '刚刚',
    agentId: agent.id,
    status: 'idle',
  }
}

function agentForConversation(conversation: BackendConversationSummary) {
  const mapped = readConversationAgentMap()[conversation.id]
  if (mapped) return mapped
  if (conversation.id.includes('projectManagerAgent')) {
    return 'projectManagerAgent'
  }
  if (conversation.id.includes('weatherAgent')) {
    return 'weatherAgent'
  }
  if (conversation.title.includes('项目管理')) {
    return 'projectManagerAgent'
  }
  if (conversation.title.includes('天气')) {
    return 'weatherAgent'
  }
  return defaultAgent.id
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: jsonHeaders(init?.headers),
  })
  if (response.status === 401) {
    redirectToOaLogin()
    throw new Error('OA login required')
  }
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(readErrorMessage(errorText) || 'Request failed: ' + response.status)
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}

function readErrorMessage(text: string) {
  const fallback = text.trim()
  if (!fallback) return ''
  try {
    const payload = JSON.parse(fallback) as Record<string, unknown>
    const message = typeof payload.message === 'string' ? payload.message : ''
    const errorCode = typeof payload.errorCode === 'string' ? payload.errorCode : ''
    return [errorCode, message].filter(Boolean).join(': ') || fallback
  } catch {
    return fallback
  }
}

function jsonHeaders(headers?: HeadersInit) {
  const next = new Headers(headers)
  if (!next.has('content-type')) {
    next.set('content-type', 'application/json')
  }
  return next
}

function clearRememberedConversationAgents() {
  window.localStorage.removeItem(CONVERSATION_AGENT_STORAGE_KEY)
}

function readConversationAgentMap(): Partial<Record<string, AgentId>> {
  try {
    const raw = window.localStorage.getItem(CONVERSATION_AGENT_STORAGE_KEY)
    if (!raw) return {}
    const value = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, AgentId] =>
          entry[1] === 'weatherAgent' || entry[1] === 'projectManagerAgent'
      )
    )
  } catch {
    return {}
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'running':
      return '运行中'
    case 'completed':
      return '已完成'
    case 'waiting_auth':
      return '等待授权'
    case 'error':
      return '执行失败'
    default:
      return '待开始'
  }
}

function formatRelativeTime(timestamp: number | string) {
  const millis = toEpochMillis(timestamp)
  if (!millis) return ''
  const date = new Date(millis)
  const diffMinutes = Math.max(0, Math.round((Date.now() - millis) / 60000))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  if (diffMinutes < 60 * 24) return `${Math.floor(diffMinutes / 60)} 小时前`
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function timelineToThreadMessages(
  timeline: ConversationTimelineEntry[]
): ThreadMessage[] {
  const messages: ThreadMessage[] = []
  let assistant: MutableAssistant | undefined

  const flushAssistant = () => {
    if (!assistant) return
    const content = assistantContent(assistant)
    if (content.length === 0) return
    messages.push(toAssistantMessage(assistant, content))
    assistant = undefined
  }

  for (const entry of timeline) {
    if (entry.kind === 'user_message' && entry.message) {
      flushAssistant()
      messages.push(toUserMessage(entry.message))
      continue
    }

    if (entry.kind !== 'agui_event' || !entry.event) {
      continue
    }

    const event = entry.event
    const type = readString(event.type)
    if (type === 'TEXT_MESSAGE_START') {
      assistant ??= createAssistant(entry)
      const messageId = readString(event.messageId)
      if (messageId) assistant.id = messageId
      startTextMessage(assistant, messageId)
      continue
    }
    if (type === 'TEXT_MESSAGE_CONTENT' || type === 'TEXT_MESSAGE_CHUNK') {
      assistant ??= createAssistant(entry)
      appendText(
        assistant,
        readString(event.delta) || readString(event.content),
        readString(event.messageId)
      )
      continue
    }
    if (type === 'TEXT_MESSAGE_END') {
      if (assistant) endTextMessage(assistant, readString(event.messageId))
      continue
    }
    if (type === 'TOOL_CALL_START') {
      assistant ??= createAssistant(entry)
      startToolCall(
        assistant,
        readString(event.toolCallId) || entry.id,
        readString(event.toolCallName) || readString(event.toolName) || 'tool',
        readString(event.parentMessageId)
      )
      continue
    }
    if (type === 'TOOL_CALL_ARGS' || type === 'TOOL_CALL_CHUNK') {
      assistant ??= createAssistant(entry)
      appendToolArgs(
        assistant,
        readString(event.toolCallId) || entry.id,
        readString(event.delta) || readJsonish(event.args)
      )
      continue
    }
    if (type === 'TOOL_CALL_RESULT') {
      assistant ??= createAssistant(entry)
      finishToolCall(
        assistant,
        readString(event.toolCallId) || entry.id,
        readString(event.content),
        readString(event.messageId)
      )
      continue
    }
    if (type === 'RUN_STARTED') {
      assistant ??= createAssistant(entry)
      continue
    }
    if (type === 'RUN_FINISHED' || type === 'RUN_ERROR') {
      flushAssistant()
    }
  }

  flushAssistant()
  return messages
}

type TextPartState = {
  buffer: string
  touched: boolean
}

type ToolCallState = {
  toolCallId: string
  toolName: string
  argsText: string
  args: JsonObject
  result?: unknown
  parentMessageId?: string
  toolMessageId?: string
}

type AssistantPartOrder =
  { kind: 'text'; key: string } | { kind: 'tool-call'; toolCallId: string }

type MutableAssistant = {
  id: string
  createdAt: Date
  activeTextMessageId?: string
  textPartCounter: number
  textParts: Map<string, TextPartState>
  toolCalls: Map<string, ToolCallState>
  partOrder: AssistantPartOrder[]
}

function createAssistant(entry: ConversationTimelineEntry): MutableAssistant {
  return {
    id: 'assistant-' + entry.id,
    createdAt: new Date(toEpochMillis(entry.timestamp) || Date.now()),
    textPartCounter: 0,
    textParts: new Map(),
    toolCalls: new Map(),
    partOrder: [],
  }
}

function generateTextKey(assistant: MutableAssistant) {
  assistant.textPartCounter += 1
  return 'text-' + assistant.textPartCounter
}

function startTextMessage(assistant: MutableAssistant, messageId?: string) {
  const key = messageId || generateTextKey(assistant)
  ensureTextPart(assistant, key)
  assistant.activeTextMessageId = key
  markTextPartTouched(assistant, key)
}

function endTextMessage(assistant: MutableAssistant, messageId?: string) {
  if (messageId && assistant.activeTextMessageId === messageId) {
    assistant.activeTextMessageId = undefined
  }
}

function resolveTextMessageId(assistant: MutableAssistant, messageId?: string) {
  if (messageId) {
    ensureTextPart(assistant, messageId)
    assistant.activeTextMessageId = messageId
    return messageId
  }

  if (assistant.activeTextMessageId) return assistant.activeTextMessageId

  const generated = generateTextKey(assistant)
  ensureTextPart(assistant, generated)
  assistant.activeTextMessageId = generated
  return generated
}

function ensureTextPart(assistant: MutableAssistant, key: string) {
  if (assistant.textParts.has(key)) return
  assistant.textParts.set(key, { buffer: '', touched: false })
  assistant.partOrder.push({ kind: 'text', key })
}

function markTextPartTouched(assistant: MutableAssistant, key: string) {
  const entry = assistant.textParts.get(key)
  if (entry) entry.touched = true
}

function appendText(
  assistant: MutableAssistant,
  text: string,
  messageId?: string
) {
  if (!text) return
  const key = resolveTextMessageId(assistant, messageId)
  const entry = assistant.textParts.get(key)
  if (!entry) return
  entry.buffer += text
  entry.touched = true
}

function startToolCall(
  assistant: MutableAssistant,
  toolCallId: string,
  toolName: string,
  parentMessageId?: string
) {
  assistant.activeTextMessageId = undefined
  if (
    !assistant.partOrder.some(
      (part) => part.kind === 'tool-call' && part.toolCallId === toolCallId
    )
  ) {
    insertToolPart(assistant, toolCallId, parentMessageId)
  }
  const state: ToolCallState = {
    toolCallId,
    toolName,
    argsText: '',
    args: {},
  }
  if (parentMessageId) state.parentMessageId = parentMessageId
  assistant.toolCalls.set(toolCallId, state)
}

function insertToolPart(
  assistant: MutableAssistant,
  toolCallId: string,
  parentMessageId?: string
) {
  const part = { kind: 'tool-call', toolCallId } as const
  if (parentMessageId) {
    const parentIndex = assistant.partOrder.findIndex(
      (entry) => entry.kind === 'text' && entry.key === parentMessageId
    )
    if (parentIndex !== -1) {
      let insertAt = parentIndex + 1
      while (insertAt < assistant.partOrder.length) {
        const next = assistant.partOrder[insertAt]
        if (
          next?.kind === 'tool-call' &&
          assistant.toolCalls.get(next.toolCallId)?.parentMessageId ===
            parentMessageId
        ) {
          insertAt += 1
          continue
        }
        break
      }
      assistant.partOrder.splice(insertAt, 0, part)
      return
    }
  }
  assistant.partOrder.push(part)
}

function appendToolArgs(
  assistant: MutableAssistant,
  toolCallId: string,
  argsText: string
) {
  if (!argsText) return
  const state = assistant.toolCalls.get(toolCallId)
  if (!state) return
  state.argsText += argsText
  state.args = parseJsonRecord(state.argsText)
}

function finishToolCall(
  assistant: MutableAssistant,
  toolCallId: string,
  content: string,
  toolMessageId?: string
) {
  let state = assistant.toolCalls.get(toolCallId)
  if (!state) {
    state = {
      toolCallId,
      toolName: 'tool',
      argsText: '',
      args: {},
    }
    assistant.toolCalls.set(toolCallId, state)
  }
  if (
    !assistant.partOrder.some(
      (part) => part.kind === 'tool-call' && part.toolCallId === toolCallId
    )
  ) {
    assistant.partOrder.push({ kind: 'tool-call', toolCallId })
  }
  state.result = parseJson(content)
  if (toolMessageId) state.toolMessageId = toolMessageId
}

function assistantContent(assistant: MutableAssistant) {
  const content: ThreadAssistantMessagePart[] = []

  for (const part of assistant.partOrder) {
    if (part.kind === 'text') {
      const entry = assistant.textParts.get(part.key)
      if (entry?.touched) {
        content.push({ type: 'text', text: entry.buffer })
      }
      continue
    }

    const state = assistant.toolCalls.get(part.toolCallId)
    if (!state) continue
    content.push({
      type: 'tool-call',
      toolCallId: state.toolCallId,
      toolName: state.toolName,
      args: state.args,
      argsText: state.argsText,
      ...(state.result !== undefined ? { result: state.result } : {}),
      ...(state.parentMessageId ? { parentId: state.parentMessageId } : {}),
      ...(state.toolMessageId
        ? { unstable_toolMessageId: state.toolMessageId }
        : {}),
    } as ThreadAssistantMessagePart)
  }

  return content
}

function toUserMessage(message: StoredChatMessage): ThreadMessage {
  return {
    id: message.id,
    role: 'user',
    createdAt: new Date(toEpochMillis(message.createdAt) || Date.now()),
    content: [{ type: 'text', text: message.content }],
    attachments: [],
    metadata: { custom: {} },
  }
}

function toAssistantMessage(
  assistant: MutableAssistant,
  content: ThreadAssistantMessagePart[]
): ThreadMessage {
  return {
    id: assistant.id,
    role: 'assistant',
    createdAt: assistant.createdAt,
    content,
    status: { type: 'complete', reason: 'unknown' },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
  }
}

function createClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function toEpochMillis(value: number | string) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseJson(value: string) {
  try {
    return value ? (JSON.parse(value) as unknown) : undefined
  } catch {
    return value
  }
}

function parseJsonRecord(value: string): JsonObject {
  const parsed = parseJson(value)
  return toJsonObject(parsed)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toJsonObject(value: unknown): JsonObject {
  if (!isRecord(value) || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, toJsonValue(entry)] as const)
      .filter(
        (entry): entry is readonly [string, JsonValue] => entry[1] !== undefined
      )
  )
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (Array.isArray(value)) {
    return value
      .map(toJsonValue)
      .filter((entry): entry is JsonValue => entry !== undefined)
  }
  if (isRecord(value)) {
    return toJsonObject(value)
  }
  return undefined
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readJsonish(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return value === undefined ? '' : JSON.stringify(value)
  } catch {
    return ''
  }
}
