import { isRecord, parseJson, readBoolean, readString } from './shared.ts'

export type OaToolResult = {
  toolName: string
  success?: boolean
  message?: string
  errorCode?: string
  result?: Record<string, unknown>
}

export const oaToolNames = new Set([
  'getMyWorkItems',
  'getUserWorkHours',
  'getWorkItemDetail',
  'generateDailyReportDraft',
  'getActiveDailyReportDraft',
  'prepareWorkHourFill',
  'saveWorkHourExecution',
  'queryDailyReportStatus',
  'submitDailyReport',
])

export const weatherToolNames = new Set(['get-weather', 'weatherTool'])

export function parseOaToolResult(
  result: unknown,
  fallbackToolName: string
): OaToolResult | undefined {
  const parsed = typeof result === 'string' ? parseJson(result) : result
  if (!isRecord(parsed)) return undefined

  const toolName = readString(parsed.toolName) || fallbackToolName
  if (!oaToolNames.has(toolName)) return undefined

  return {
    toolName,
    success: readBoolean(parsed.success),
    message: publicToolMessage(parsed.message),
    errorCode: readString(parsed.errorCode),
    result: isRecord(parsed.result) ? parsed.result : undefined,
  }
}

export function publicToolMessage(value: unknown, fallback?: string) {
  const message = readString(value)?.trim()
  if (!message) return fallback
  if (
    message.length > 240 ||
    /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/.test(message) ||
    /\b(?:get|save|submit|query|prepare|generate)[A-Z][A-Za-z0-9]+\b/.test(
      message
    ) ||
    /(?:auditId|userId|traceId|runId|toolName|tool call|tool execution|request id|response payload|https?:\/\/|\/(?:api|internal|v\d+)\/|<html|exception|stack trace)/i.test(
      message
    )
  ) {
    return fallback
  }
  return message
}

type SafeToolFallbackInput = {
  status?: { type?: unknown }
  toolName?: unknown
  argsText?: unknown
  result?: unknown
}

export type SafeToolFallbackPresentation = {
  title: string
  detail: string
  state: 'running' | 'complete' | 'failed' | 'waiting'
}

export function safeToolFallbackPresentation(
  input: SafeToolFallbackInput
): SafeToolFallbackPresentation {
  const statusType = isRecord(input.status)
    ? readString(input.status.type)
    : undefined

  if (statusType === 'running') {
    return {
      title: '正在执行业务操作',
      detail: '正在等待业务系统返回结果。',
      state: 'running',
    }
  }
  if (statusType === 'requires-action') {
    return {
      title: '业务操作等待确认',
      detail: '请根据页面中的业务提示完成确认。',
      state: 'waiting',
    }
  }
  if (statusType === 'incomplete') {
    return {
      title: '业务操作未完成',
      detail: '未收到可用的业务结果，请根据最终回复重试。',
      state: 'failed',
    }
  }
  return {
    title: '业务操作已完成',
    detail: '业务结果已交给智能体继续处理。',
    state: 'complete',
  }
}
