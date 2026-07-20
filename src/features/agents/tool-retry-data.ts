type ToolPart = {
  type?: unknown
  toolName?: unknown
  result?: unknown
  isError?: unknown
}

export function visibleToolGroupPositions(
  parts: readonly ToolPart[],
  indices: readonly number[]
) {
  return indices.flatMap((partIndex, groupPosition) => {
    const part = parts[partIndex]
    if (!isFailedToolPart(part)) return [groupPosition]

    const recovered = indices.slice(groupPosition + 1).some((laterIndex) => {
      const later = parts[laterIndex]
      return (
        later?.type === 'tool-call' &&
        later.toolName === part?.toolName &&
        toolPartSucceeded(later)
      )
    })
    return recovered ? [] : [groupPosition]
  })
}

function isFailedToolPart(part: ToolPart | undefined) {
  if (part?.type !== 'tool-call') return false
  if (part.isError === true) return true
  const result = parsedResult(part.result)
  return result?.success === false || Boolean(result?.errorCode)
}

function toolPartSucceeded(part: ToolPart) {
  if (part.isError === true || part.result === undefined) return false
  const result = parsedResult(part.result)
  if (result) {
    if (result.success === false || result.errorCode) return false
    if (result.success === true) return true
  }
  return true
}

function parsedResult(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return undefined
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
