import type { OaTaskDeltaRequest } from './runtime-http-agent'

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
