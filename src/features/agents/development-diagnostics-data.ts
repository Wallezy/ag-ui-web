import type { AgentHealthResponse } from './api'

export type BackendDiagnostics = {
  status: string
  activeProfiles: readonly string[]
  publicEventSchemaVersion: number | null
  taskStateSchemaVersion: number | null
  calibrationExecutionEligible: boolean | null
}

export function parseBackendDiagnostics(
  health: AgentHealthResponse
): BackendDiagnostics | null {
  const config = record(health.oaDevelopmentDiagnostics)
  if (!config) return null
  const calibration = record(config.calibration)

  return {
    status: boundedText(health.status) ?? 'UNKNOWN',
    activeProfiles: stringList(config.activeProfiles),
    publicEventSchemaVersion: integer(config.publicEventSchemaVersion),
    taskStateSchemaVersion: integer(config.taskStateSchemaVersion),
    calibrationExecutionEligible:
      typeof calibration?.executionEligible === 'boolean'
        ? calibration.executionEligible
        : null,
  }
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is string =>
        typeof item === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(item)
    )
    .slice(0, 10)
}

function integer(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : null
}

function boundedText(value: unknown, maximum = 80) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum
    ? value
    : null
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
