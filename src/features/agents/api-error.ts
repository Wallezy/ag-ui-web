export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export type OaSessionFailure = {
  kind: 'login-required' | 'unavailable'
  message: string
}

export function classifyOaSessionFailure(error: unknown): OaSessionFailure {
  if (error instanceof ApiRequestError && error.status === 401) {
    return {
      kind: 'login-required',
      message: error.message || '当前浏览器没有有效 OA 登录态',
    }
  }

  if (error instanceof ApiRequestError) {
    return {
      kind: 'unavailable',
      message: `Agent 服务暂时不可用（HTTP ${error.status}），请稍后重试。`,
    }
  }

  return {
    kind: 'unavailable',
    message: '无法连接 Agent 服务，请检查服务状态后重试。',
  }
}
