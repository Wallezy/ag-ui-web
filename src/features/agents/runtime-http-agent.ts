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

type RuntimeRunOptions = {
  signal?: AbortSignal
}

type AbortableRunParameters = RunAgentParameters & {
  abortController?: AbortController
}

export const AGENT_RUN_CONFLICT_MESSAGE =
  '上一轮请求仍在结束，请稍候再试。若持续出现，请刷新当前会话。'
export const AGENT_RUN_INCOMPLETE_MESSAGE = '智能体连接提前结束，请重试。'

const LOCAL_PROGRESS_SEQUENCE = 2_147_483_647

export class RuntimeHttpAgent extends HttpAgent {
  private activeRun: Promise<RunAgentResult> | null = null
  readonly taskViewStore = new AgentTaskViewStore()

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

    try {
      const guardedSubscriber = terminalGuard(
        parameters,
        publicEventSubscriber(this.taskViewStore, subscriber)
      )
      return await super.runAgent(
        { ...parameters, abortController: requestController },
        guardedSubscriber
      )
    } catch (error) {
      if (httpStatus(error) === 409) {
        throw new Error(AGENT_RUN_CONFLICT_MESSAGE)
      }
      throw error
    } finally {
      listeners.forEach(({ signal, listener }) =>
        signal.removeEventListener('abort', listener)
      )
    }
  }
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
