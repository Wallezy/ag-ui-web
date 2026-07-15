import { ApiRequestError } from './api-error.ts'

export type DailyReportOperationMode = 'create' | 'update'

export function dailyReportOperationCopy(mode: DailyReportOperationMode) {
  if (mode === 'update') {
    return {
      readyTitle: '已加载今天的日报',
      pendingStatus: '待保存',
      readyAction: '修改已准备好',
      description: '你可以直接修改工作总结，保存前请核对日报明细。',
      reportBadge: '当前日报',
      confirmLabel: '确认保存修改',
    }
  }

  return {
    readyTitle: '日报草稿已整理好',
    pendingStatus: '待提交',
    readyAction: '信息已齐，可以提交',
    description: '请核对工作总结和明细，确认无误后提交。',
    reportBadge: '日报草稿',
    confirmLabel: '确认提交日报',
  }
}

type DailyReportFailure = {
  errorCode?: string
  code?: string
  message?: string
}

export function dailyReportOperationMode(
  value: unknown,
  existingReport = false
): DailyReportOperationMode {
  return value === 'update' || existingReport ? 'update' : 'create'
}

export function dailyReportErrorMessage(
  error: unknown,
  fallback = '暂时无法保存日报，请稍后重试。'
) {
  const code = dailyReportErrorCode(error).toUpperCase()

  if (code.includes('VALIDATION')) {
    return '日报还有内容需要补充，请检查后再保存。'
  }
  if (
    code.includes('DRAFT_NOT_FOUND') ||
    code.includes('DRAFT_EXPIRED') ||
    code.includes('INTENT_INVALID') ||
    code.includes('VERSION_CONFLICT')
  ) {
    return '这份日报信息已失效，请重新加载今天的日报后再修改。'
  }
  if (code.includes('IN_PROGRESS')) {
    return '正在保存日报，请稍候。'
  }
  if (code.includes('RECORD_UNAVAILABLE')) {
    return '暂时无法读取今天的日报编号，请重新加载后再保存。'
  }
  if (code.includes('UNKNOWN') || code.includes('STATE_CONFLICT')) {
    return '保存结果暂时无法确认，请先查询今天的日报状态。'
  }
  if (code.includes('DUPLICATE') || code.includes('ALREADY_EXISTS')) {
    return '今天的日报已经存在，请重新加载后进行修改。'
  }
  if (code.includes('FORBIDDEN') || code.includes('PERMISSION')) {
    return '你当前不能保存这份日报，请确认账号权限后重试。'
  }
  if (code.includes('LOGIN') || code.includes('UNAUTHORIZED')) {
    return 'OA 登录状态已失效，请重新登录后再保存。'
  }
  if (
    code.includes('HTTP_SERVER_ERROR') ||
    code.includes('TRANSPORT_ERROR') ||
    code.includes('RESPONSE_JSON_FAILED') ||
    code.includes('REQUEST_INTERRUPTED') ||
    code.includes('TOOL_FAILED')
  ) {
    return 'OA 服务暂时不可用，请稍后重试。'
  }
  if (error instanceof TypeError) {
    return '无法连接 OA 服务，请检查网络后重试。'
  }

  const message = publicMessage(error)
  return message && !containsInternalCode(message) ? message : fallback
}

function dailyReportErrorCode(error: unknown) {
  if (error instanceof ApiRequestError) return error.code ?? ''
  if (!isRecord(error)) return ''
  if (typeof error.errorCode === 'string') return error.errorCode
  if (typeof error.code === 'string') return error.code
  return ''
}

function publicMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim()
  if (!isRecord(error) || typeof error.message !== 'string') return ''
  return error.message.trim()
}

function containsInternalCode(message: string) {
  return /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/.test(message)
}

function isRecord(value: unknown): value is DailyReportFailure {
  return typeof value === 'object' && value !== null
}
