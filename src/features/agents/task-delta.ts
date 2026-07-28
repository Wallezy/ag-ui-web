import type { OaTaskDeltaRequest } from './runtime-http-agent'

export type TaskDeltaLifecycleStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'SENDING'
  | 'RETRYABLE_UNKNOWN'
  | 'CONFLICTED'
  | 'ACKNOWLEDGED'
  | 'DISCARDED'

export type TaskDeltaFailureKind = 'unknown_result' | 'conflict' | 'connection'

export type TaskDeltaLifecycleSnapshot = {
  status: TaskDeltaLifecycleStatus
  delta: OaTaskDeltaRequest | null
  sourceMessageId: string | null
  failureKind: TaskDeltaFailureKind | null
  authoritativeRefreshRequired: boolean
}

const INITIAL_TASK_DELTA_STATE: TaskDeltaLifecycleSnapshot = {
  status: 'IDLE',
  delta: null,
  sourceMessageId: null,
  failureKind: null,
  authoritativeRefreshRequired: false,
}

export class TaskDeltaLifecycleStore {
  private state = INITIAL_TASK_DELTA_STATE
  private readonly listeners = new Set<() => void>()

  getSnapshot = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  queue(delta: OaTaskDeltaRequest) {
    if (!['IDLE', 'ACKNOWLEDGED', 'DISCARDED'].includes(this.state.status)) {
      return false
    }
    this.update({
      status: 'QUEUED',
      delta: { ...delta, sourceMessageId: undefined },
      sourceMessageId: null,
      failureKind: null,
      authoritativeRefreshRequired: false,
    })
    return true
  }

  prepareForSend(sourceMessageId: string | null) {
    if (
      this.state.status !== 'QUEUED' ||
      !this.state.delta ||
      !sourceMessageId
    ) {
      return null
    }
    if (
      this.state.sourceMessageId &&
      this.state.sourceMessageId !== sourceMessageId
    ) {
      return null
    }
    const fixedSourceMessageId = this.state.sourceMessageId ?? sourceMessageId
    const request = {
      ...this.state.delta,
      sourceMessageId: fixedSourceMessageId,
    }
    this.update({
      ...this.state,
      status: 'SENDING',
      delta: request,
      sourceMessageId: fixedSourceMessageId,
      failureKind: null,
    })
    return request
  }

  acknowledge(request: OaTaskDeltaRequest) {
    if (!this.matches(request)) return false
    this.update({
      status: 'ACKNOWLEDGED',
      delta: null,
      sourceMessageId: this.state.sourceMessageId,
      failureKind: null,
      authoritativeRefreshRequired: false,
    })
    return true
  }

  markUnknown(request: OaTaskDeltaRequest) {
    return this.fail(request, 'RETRYABLE_UNKNOWN', 'unknown_result', false)
  }

  markConnectionFailure(request: OaTaskDeltaRequest) {
    return this.fail(request, 'QUEUED', 'connection', false)
  }

  markConflict(request: OaTaskDeltaRequest) {
    return this.fail(request, 'CONFLICTED', 'conflict', true)
  }

  retry() {
    if (this.state.status === 'QUEUED') return true
    if (this.state.status !== 'RETRYABLE_UNKNOWN' || !this.state.delta)
      return false
    this.update({ ...this.state, status: 'QUEUED', failureKind: null })
    return true
  }

  discard() {
    if (this.state.status === 'IDLE') return false
    this.update({
      status: 'DISCARDED',
      delta: null,
      sourceMessageId: null,
      failureKind: null,
      authoritativeRefreshRequired: false,
    })
    return true
  }

  rebase(expectedVersion: number) {
    if (
      this.state.status !== 'CONFLICTED' ||
      !this.state.delta ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0
    ) {
      return false
    }
    this.update({
      status: 'QUEUED',
      delta: {
        ...this.state.delta,
        expectedVersion,
        sourceMessageId: undefined,
      },
      sourceMessageId: null,
      failureKind: null,
      authoritativeRefreshRequired: false,
    })
    return true
  }

  private fail(
    request: OaTaskDeltaRequest,
    status: 'QUEUED' | 'RETRYABLE_UNKNOWN' | 'CONFLICTED',
    failureKind: TaskDeltaFailureKind,
    authoritativeRefreshRequired: boolean
  ) {
    if (!this.matches(request)) return false
    this.update({
      ...this.state,
      status,
      delta: { ...request },
      failureKind,
      authoritativeRefreshRequired,
    })
    return true
  }

  private matches(request: OaTaskDeltaRequest) {
    return (
      this.state.status === 'SENDING' &&
      this.state.sourceMessageId === request.sourceMessageId
    )
  }

  private update(next: TaskDeltaLifecycleSnapshot) {
    this.state = next
    this.listeners.forEach((listener) => listener())
  }
}

export const EDITABLE_OA_FIELDS = new Set([
  'subject',
  'assigneeName',
  'period',
  'beginDate',
  'endDate',
  'workDate',
  'projectName',
  'workItemType',
  'workItemTypes',
  'workItemId',
  'queryKind',
])

export function fieldCorrectionDelta(input: {
  taskId: string
  expectedVersion: number
  slotName: string
  value: string | null
}): OaTaskDeltaRequest | null {
  if (!EDITABLE_OA_FIELDS.has(input.slotName)) return null
  const value = input.value?.trim() ?? ''
  return {
    schemaVersion: 1,
    operation: value ? 'REPLACE_SLOT' : 'CLEAR_SLOT',
    taskId: input.taskId,
    expectedVersion: input.expectedVersion,
    slotName: input.slotName,
    oldValue: null,
    newValue: value || null,
  }
}
