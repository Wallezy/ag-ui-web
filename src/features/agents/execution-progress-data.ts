export type ExecutionProgressUpdate = {
  kind: 'execution_progress'
  stepId: string
  phase:
    | 'understanding'
    | 'routing'
    | 'planning'
    | 'tool'
    | 'observation'
    | 'response'
  status:
    'running' | 'completed' | 'failed' | 'waiting_user' | 'waiting_confirmation'
  title: string
  detail: string
  sequence: number
}

export type ExecutionProgressStep = ExecutionProgressUpdate & {
  firstSequence: number
}

export function parseExecutionProgress(text: string): ExecutionProgressStep[] {
  const steps = new Map<string, ExecutionProgressStep>()

  for (const line of text.split('\n')) {
    const update = parseUpdate(line)
    if (!update) continue
    const previous = steps.get(update.stepId)
    steps.set(update.stepId, {
      ...update,
      firstSequence: previous?.firstSequence ?? update.sequence,
    })
  }

  return [...steps.values()].sort(
    (left, right) => left.firstSequence - right.firstSequence
  )
}

function parseUpdate(line: string): ExecutionProgressUpdate | null {
  const value = line.trim()
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (
      parsed.kind !== 'execution_progress' ||
      typeof parsed.stepId !== 'string' ||
      !parsed.stepId.trim() ||
      !isPhase(parsed.phase) ||
      !isStatus(parsed.status) ||
      typeof parsed.title !== 'string' ||
      typeof parsed.detail !== 'string' ||
      typeof parsed.sequence !== 'number' ||
      !Number.isSafeInteger(parsed.sequence) ||
      parsed.sequence < 0
    ) {
      return null
    }
    return {
      kind: parsed.kind,
      stepId: parsed.stepId,
      phase: parsed.phase,
      status: parsed.status,
      title: parsed.title,
      detail: parsed.detail,
      sequence: parsed.sequence,
    }
  } catch {
    return null
  }
}

function isPhase(value: unknown): value is ExecutionProgressUpdate['phase'] {
  return (
    value === 'understanding' ||
    value === 'routing' ||
    value === 'planning' ||
    value === 'tool' ||
    value === 'observation' ||
    value === 'response'
  )
}

function isStatus(value: unknown): value is ExecutionProgressUpdate['status'] {
  return (
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'waiting_user' ||
    value === 'waiting_confirmation'
  )
}
