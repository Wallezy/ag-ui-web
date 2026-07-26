export const OA_PUBLIC_AGENT_EVENT = 'oa.public_agent_event'

export type OaPublicEventType =
  | 'OA_UNDERSTANDING_READY'
  | 'OA_CLARIFICATION_REQUIRED'
  | 'OA_PLAN_CREATED'
  | 'OA_STEP_STARTED'
  | 'OA_OBSERVATION_RECEIVED'
  | 'OA_REPAIR_TRIGGERED'
  | 'OA_TASK_STATE_UPDATED'
  | 'OA_VERIFICATION_COMPLETED'

type PublicPayload = {
  reasonCode: string
  displayMessage: string
  fields?: string[]
  slots?: readonly PublicSlot[]
  status?: string
  action?: string
  stepId?: string
  stepStatus?: string
  selectedIntentId?: string
  questionId?: string
  questionKind?: 'SEMANTIC_CLARIFICATION' | 'USER_ACTION' | 'WRITE_CONFIRMATION'
  options?: readonly PublicQuestionOption[]
  allowFreeText?: boolean
  expiresAt?: string
}

export type PublicSlot = {
  name: string
  label: string
  valueSummary: string
  source: string
  status: string
  critical: boolean
  editable: boolean
  conflictReason: string
}

export type PublicQuestionOption = { optionId: string; label: string }

export type OaPublicAgentEvent = {
  schemaVersion: 2 | 3
  eventId: string
  traceId: string
  taskId: string
  taskVersion: number
  eventType: OaPublicEventType
  occurredAt: string
  payload: PublicPayload
}

export type AgentTaskStep = {
  stepId: string
  status: string
  reasonCode: string
  displayMessage: string
}

export type AgentTaskRepair = {
  eventId: string
  stepId: string
  reasonCode: string
  action: string
  displayMessage: string
  status: string
}

export type AgentTaskViewState = {
  traceId: string | null
  taskId: string | null
  taskVersion: number
  schemaVersion: 2 | 3 | null
  eventIds: ReadonlySet<string>
  understanding: PublicPayload | null
  pending: PublicPayload | null
  steps: Readonly<Record<string, AgentTaskStep>>
  repairs: readonly AgentTaskRepair[]
  verification: PublicPayload | null
  terminal: 'complete' | 'waiting_user' | 'failed' | null
  v2Observed: boolean
}

export const initialAgentTaskViewState: AgentTaskViewState = {
  traceId: null,
  taskId: null,
  taskVersion: -1,
  schemaVersion: null,
  eventIds: new Set(),
  understanding: null,
  pending: null,
  steps: {},
  repairs: [],
  verification: null,
  terminal: null,
  v2Observed: false,
}

const EVENT_TYPES: ReadonlySet<string> = new Set<OaPublicEventType>([
  'OA_UNDERSTANDING_READY',
  'OA_CLARIFICATION_REQUIRED',
  'OA_PLAN_CREATED',
  'OA_STEP_STARTED',
  'OA_OBSERVATION_RECEIVED',
  'OA_REPAIR_TRIGGERED',
  'OA_TASK_STATE_UPDATED',
  'OA_VERIFICATION_COMPLETED',
])

const OPTIONAL_PAYLOAD_KEYS = [
  'fields',
  'slots',
  'status',
  'action',
  'stepId',
  'stepStatus',
  'selectedIntentId',
  'questionId',
  'questionKind',
  'options',
  'allowFreeText',
  'expiresAt',
] as const

export function parseOaPublicAgentEvent(
  value: unknown
): OaPublicAgentEvent | null {
  if (
    !isRecord(value) ||
    (value.schemaVersion !== 2 && value.schemaVersion !== 3)
  )
    return null
  if (
    !isIdentifier(value.eventId) ||
    !isIdentifier(value.traceId) ||
    !isIdentifier(value.taskId) ||
    !Number.isSafeInteger(value.taskVersion) ||
    (value.taskVersion as number) < 0 ||
    typeof value.eventType !== 'string' ||
    !EVENT_TYPES.has(value.eventType) ||
    typeof value.occurredAt !== 'string' ||
    !isIsoInstant(value.occurredAt) ||
    !isPublicPayload(value.payload, value.schemaVersion)
  ) {
    return null
  }
  return value as OaPublicAgentEvent
}

export function reduceAgentTaskViewState(
  current: AgentTaskViewState,
  event: OaPublicAgentEvent
): AgentTaskViewState {
  const newTask = current.taskId !== null && current.taskId !== event.taskId
  const base = newTask ? initialAgentTaskViewState : current
  if (base.eventIds.has(event.eventId)) return base
  if (event.taskVersion < base.taskVersion) return base
  if (
    base.terminal !== null &&
    event.taskVersion <= base.taskVersion &&
    event.eventType !== 'OA_VERIFICATION_COMPLETED'
  ) {
    return base
  }

  const eventIds = new Set(base.eventIds)
  eventIds.add(event.eventId)
  const next: AgentTaskViewState = {
    ...base,
    traceId: event.traceId,
    taskId: event.taskId,
    taskVersion: event.taskVersion,
    schemaVersion: event.schemaVersion,
    eventIds,
    v2Observed: true,
    ...(event.taskVersion > base.taskVersion
      ? { terminal: null, pending: null }
      : {}),
  }
  const payload = event.payload

  switch (event.eventType) {
    case 'OA_UNDERSTANDING_READY':
    case 'OA_TASK_STATE_UPDATED':
      return { ...next, understanding: payload }
    case 'OA_CLARIFICATION_REQUIRED':
      return { ...next, pending: payload, terminal: 'waiting_user' }
    case 'OA_PLAN_CREATED':
      return next
    case 'OA_STEP_STARTED':
    case 'OA_OBSERVATION_RECEIVED': {
      if (!payload.stepId) return next
      return {
        ...next,
        steps: {
          ...next.steps,
          [payload.stepId]: {
            stepId: payload.stepId,
            status: payload.stepStatus ?? payload.status ?? 'UNKNOWN',
            reasonCode: payload.reasonCode,
            displayMessage: payload.displayMessage,
          },
        },
      }
    }
    case 'OA_REPAIR_TRIGGERED':
      return {
        ...next,
        repairs: [
          ...next.repairs,
          {
            eventId: event.eventId,
            stepId: payload.stepId ?? '',
            reasonCode: payload.reasonCode,
            action: payload.action ?? '',
            displayMessage: payload.displayMessage,
            status: payload.status ?? 'RUNNING',
          },
        ],
      }
    case 'OA_VERIFICATION_COMPLETED':
      return {
        ...next,
        verification: payload,
        pending:
          payload.status === 'CLARIFICATION_REQUIRED' ? next.pending : null,
        terminal: verificationTerminal(payload.status),
      }
  }
}

export class AgentTaskViewStore {
  private state = initialAgentTaskViewState
  private readonly listeners = new Set<() => void>()

  getSnapshot = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  accept(value: unknown) {
    const event = parseOaPublicAgentEvent(value)
    if (!event) return false
    const next = reduceAgentTaskViewState(this.state, event)
    if (next === this.state) return false
    this.state = next
    this.listeners.forEach((listener) => listener())
    return true
  }

  invalidate() {
    if (this.state === initialAgentTaskViewState) return false
    this.state = initialAgentTaskViewState
    this.listeners.forEach((listener) => listener())
    return true
  }
}

function verificationTerminal(status: string | undefined) {
  if (status === 'COMPLETE') return 'complete' as const
  if (status === 'CLARIFICATION_REQUIRED') return 'waiting_user' as const
  if (status === 'FAIL_SAFE') return 'failed' as const
  return null
}

function isPublicPayload(
  value: unknown,
  schemaVersion: 2 | 3
): value is PublicPayload {
  if (
    !isRecord(value) ||
    !isBoundedText(value.reasonCode, 160) ||
    !isBoundedText(value.displayMessage, 500)
  ) {
    return false
  }
  for (const key of OPTIONAL_PAYLOAD_KEYS) {
    const item = value[key]
    if (item === undefined) continue
    if (key === 'fields') {
      if (
        !Array.isArray(item) ||
        item.length > 32 ||
        !item.every((field) => isBoundedText(field, 120))
      ) {
        return false
      }
      continue
    }
    if (key === 'slots') {
      if (schemaVersion !== 3 || !isPublicSlots(item)) return false
      continue
    }
    if (key === 'options') {
      if (!isQuestionOptions(item)) return false
      continue
    }
    if (key === 'allowFreeText') {
      if (typeof item !== 'boolean') return false
      continue
    }
    if (key === 'expiresAt') {
      if (typeof item !== 'string' || !isIsoInstant(item)) return false
      continue
    }
    if (key === 'questionKind') {
      if (
        ![
          'SEMANTIC_CLARIFICATION',
          'USER_ACTION',
          'WRITE_CONFIRMATION',
        ].includes(String(item))
      )
        return false
      continue
    }
    if (!isBoundedText(item, 160)) return false
  }
  return true
}

function isPublicSlots(value: unknown): value is readonly PublicSlot[] {
  if (!Array.isArray(value) || value.length > 32) return false
  return value.every(
    (slot) =>
      isRecord(slot) &&
      isBoundedText(slot.name, 120) &&
      isBoundedText(slot.label, 160) &&
      isBoundedText(slot.valueSummary, 160) &&
      isBoundedText(slot.source, 160) &&
      isBoundedText(slot.status, 160) &&
      typeof slot.critical === 'boolean' &&
      typeof slot.editable === 'boolean' &&
      typeof slot.conflictReason === 'string' &&
      slot.conflictReason.length <= 160
  )
}

function isQuestionOptions(value: unknown): value is PublicQuestionOption[] {
  return (
    Array.isArray(value) &&
    value.length <= 5 &&
    value.every(
      (option) =>
        isRecord(option) &&
        Object.keys(option).length === 2 &&
        isIdentifier(option.optionId) &&
        isBoundedText(option.label, 160)
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value)
}

function isBoundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maximum
  )
}

function isIsoInstant(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && value.includes('T')
}
