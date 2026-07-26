import {
  EventType,
  HttpAgent,
  type AgentSubscriber,
  type RunAgentParameters,
  type RunAgentResult,
} from '@ag-ui/client'
import {
  AgentTaskViewStore,
  OA_PUBLIC_AGENT_EVENT,
} from './oa-public-events.ts'
import { TaskDeltaLifecycleStore } from './task-delta.ts'

type RuntimeRunOptions = {
  signal?: AbortSignal
}

type AbortableRunParameters = RunAgentParameters & {
  abortController?: AbortController
}

export type OaTaskDeltaRequest = {
  schemaVersion: 1
  operation:
    'SELECT_CANDIDATE' | 'ANSWER_CLARIFICATION' | 'REPLACE_SLOT' | 'CLEAR_SLOT'
  taskId: string
  expectedVersion: number
  sourceMessageId?: string
  slotName?: string
  oldValue?: unknown
  newValue?: unknown
  questionId?: string
  optionId?: string
  freeText?: string
}

export const AGENT_RUN_CONFLICT_MESSAGE =
  '上一轮请求仍在结束，请稍候再试。若持续出现，请刷新当前会话。'
export const AGENT_RUN_INCOMPLETE_MESSAGE = '智能体连接提前结束，请重试。'
export const TASK_DELTA_UNKNOWN_RESULT_MESSAGE =
  '修改结果暂时无法确认，请重试本次修改或将其废弃。'
export const TASK_DELTA_CONNECTION_FAILURE_MESSAGE =
  '修改未能送达服务端，请检查连接后重试。'

const LOCAL_PROGRESS_SEQUENCE = 2_147_483_647

export class RuntimeHttpAgent extends HttpAgent {
  private activeRun: Promise<RunAgentResult> | null = null
  readonly taskViewStore = new AgentTaskViewStore()
  readonly taskDeltaStore = new TaskDeltaLifecycleStore()

  queueTaskDelta(delta: OaTaskDeltaRequest) {
    return this.taskDeltaStore.queue(delta)
  }

  retryTaskDelta() {
    return this.taskDeltaStore.retry()
  }

  discardTaskDelta() {
    return this.taskDeltaStore.discard()
  }

  rebaseTaskDelta(expectedVersion: number) {
    return this.taskDeltaStore.rebase(expectedVersion)
  }

  override runAgent(
    parameters?: AbortableRunParameters,
    subscriber?: AgentSubscriber,
    runtimeOptions?: RuntimeRunOptions
  ): Promise<RunAgentResult> {
    const previousRun = this.activeRun
    const currentRun = this.runAfterPrevious(
      previousRun,
      parameters,
      subscriber,
      runtimeOptions
    )
    this.activeRun = currentRun
    const clearCurrentRun = () => {
      if (this.activeRun === currentRun) this.activeRun = null
    }
    void currentRun.then(clearCurrentRun, clearCurrentRun)
    return currentRun
  }

  private async runAfterPrevious(
    previousRun: Promise<RunAgentResult> | null,
    parameters?: AbortableRunParameters,
    subscriber?: AgentSubscriber,
    runtimeOptions?: RuntimeRunOptions
  ) {
    await previousRun?.catch(() => undefined)

    if (parameters?.runId) {
      this.taskViewStore.beginRun(parameters.runId)
    }

    const requestController = new AbortController()
    const sourceSignals = [
      runtimeOptions?.signal,
      parameters?.abortController?.signal,
    ].filter((signal): signal is AbortSignal => signal != null)
    const abortRequest = (signal: AbortSignal) => {
      if (!requestController.signal.aborted) {
        requestController.abort(signal.reason)
      }
    }
    const listeners = sourceSignals.map((signal) => {
      const listener = () => abortRequest(signal)
      if (signal.aborted) abortRequest(signal)
      else signal.addEventListener('abort', listener, { once: true })
      return { signal, listener }
    })
    let taskDelta: OaTaskDeltaRequest | null = null

    try {
      const sourceMessageId = latestUserMessageId(parameters)
      taskDelta = this.taskDeltaStore.prepareForSend(sourceMessageId)
      const forwardedParameters = taskDelta
        ? {
            ...parameters,
            forwardedProps: {
              ...(parameters?.forwardedProps ?? {}),
              oaTaskDelta: taskDelta,
            },
          }
        : parameters
      const guardedSubscriber = terminalGuard(
        forwardedParameters,
        publicEventSubscriber(this.taskViewStore, subscriber)
      )
      const result = await super.runAgent(
        { ...forwardedParameters, abortController: requestController },
        guardedSubscriber
      )
      if (taskDelta) {
        if (requestController.signal.aborted) {
          this.taskDeltaStore.markUnknown(taskDelta)
        } else {
          this.taskDeltaStore.acknowledge(taskDelta)
        }
      }
      return result
    } catch (error) {
      const status = httpStatus(error)
      if (status === 409) {
        if (taskDelta) {
          this.taskDeltaStore.markConflict(taskDelta)
          this.taskViewStore.invalidate()
        }
        throw new Error(AGENT_RUN_CONFLICT_MESSAGE)
      }
      if (taskDelta && status === null) {
        this.taskDeltaStore.markUnknown(taskDelta)
        throw new Error(TASK_DELTA_UNKNOWN_RESULT_MESSAGE, { cause: error })
      }
      if (taskDelta) {
        this.taskDeltaStore.markConnectionFailure(taskDelta)
        throw new Error(TASK_DELTA_CONNECTION_FAILURE_MESSAGE, { cause: error })
      }
      throw error
    } finally {
      listeners.forEach(({ signal, listener }) =>
        signal.removeEventListener('abort', listener)
      )
    }
  }
}

function latestUserMessageId(parameters?: AbortableRunParameters) {
  if (
    !parameters ||
    !('messages' in parameters) ||
    !Array.isArray(parameters.messages)
  ) {
    return null
  }
  const messages = parameters.messages
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === 'user' && typeof message.id === 'string')
      return message.id
  }
  return null
}

function publicEventSubscriber(
  store: AgentTaskViewStore,
  subscriber?: AgentSubscriber
): AgentSubscriber {
  return {
    ...subscriber,
    onCustomEvent: (params) => {
      if (params.event.name === OA_PUBLIC_AGENT_EVENT) {
        store.accept(params.event.value)
      }
      return subscriber?.onCustomEvent?.(params)
    },
  }
}

function terminalGuard(
  parameters?: AbortableRunParameters,
  subscriber?: AgentSubscriber
): AgentSubscriber | undefined {
  if (!subscriber) return undefined

  let terminalObserved = false
  const markTerminal = () => {
    terminalObserved = true
  }

  return {
    ...subscriber,
    onEvent: (params) => {
      if (
        params.event.type === 'RUN_FINISHED' ||
        params.event.type === 'RUN_ERROR'
      ) {
        markTerminal()
      }
      return subscriber.onEvent?.(params)
    },
    onRunFinishedEvent: (params) => {
      markTerminal()
      return subscriber.onRunFinishedEvent?.(params)
    },
    onRunErrorEvent: (params) => {
      markTerminal()
      if (subscriber.onRunErrorEvent) {
        return subscriber.onRunErrorEvent(params)
      }
      const error = Object.assign(
        new Error(params.event.message || AGENT_RUN_INCOMPLETE_MESSAGE),
        params.event.code ? { code: params.event.code } : {}
      )
      return subscriber.onRunFailed?.({ ...params, error })
    },
    onRunFailed: (params) => {
      markTerminal()
      return subscriber.onRunFailed?.(params)
    },
    onRunFinalized: (params) => {
      if (terminalObserved) {
        return subscriber.onRunFinalized?.(params)
      }

      markTerminal()
      const runId = parameters?.runId || params.input.runId
      const messageId = `execution-progress-${runId}`
      const progressDelta = `${JSON.stringify({
        kind: 'execution_progress',
        stepId: 'response',
        phase: 'response',
        status: 'failed',
        title: '连接已中断',
        detail: '未收到完整的运行结果，请重试',
        sequence: LOCAL_PROGRESS_SEQUENCE,
      })}\n`
      const progressStart = subscriber.onReasoningMessageStartEvent?.({
        ...params,
        event: {
          type: EventType.REASONING_MESSAGE_START,
          messageId,
          role: 'reasoning',
        },
      })
      const progressContent = subscriber.onReasoningMessageContentEvent?.({
        ...params,
        event: {
          type: EventType.REASONING_MESSAGE_CONTENT,
          messageId,
          delta: progressDelta,
        },
        reasoningMessageBuffer: '',
      })
      const progressEnd = subscriber.onReasoningMessageEndEvent?.({
        ...params,
        event: { type: EventType.REASONING_MESSAGE_END, messageId },
        reasoningMessageBuffer: progressDelta,
      })
      const runFailed = subscriber.onRunFailed?.({
        ...params,
        error: new Error(AGENT_RUN_INCOMPLETE_MESSAGE),
      })
      return Promise.all([
        progressStart,
        progressContent,
        progressEnd,
        runFailed,
      ]).then(() => undefined)
    },
  }
}

function httpStatus(error: unknown) {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null
  }
  return typeof error.status === 'number' ? error.status : null
}
