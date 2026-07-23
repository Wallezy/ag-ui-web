import {
  HttpAgent,
  type AgentSubscriber,
  type RunAgentParameters,
  type RunAgentResult,
} from '@ag-ui/client'

type RuntimeRunOptions = {
  signal?: AbortSignal
}

type AbortableRunParameters = RunAgentParameters & {
  abortController?: AbortController
}

export const AGENT_RUN_CONFLICT_MESSAGE =
  '上一轮请求仍在结束，请稍候再试。若持续出现，请刷新当前会话。'

export class RuntimeHttpAgent extends HttpAgent {
  private activeRun: Promise<RunAgentResult> | null = null

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
      return await super.runAgent(
        { ...parameters, abortController: requestController },
        subscriber
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

function httpStatus(error: unknown) {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null
  }
  return typeof error.status === 'number' ? error.status : null
}
