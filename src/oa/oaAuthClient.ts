export type OaAuthContext = {
  agentId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  runId?: string;
  traceId?: string;
  threadId?: string;
};

export type OaUserSummary = {
  userId?: string;
  userName?: string;
  department?: string;
};

export type OaSessionStatus = {
  authenticated: boolean;
  username?: string;
  tenantId?: string;
  user?: OaUserSummary;
  expiresAt?: string;
  errorCode?: string;
  message?: string;
};

export type OaLoginInput = {
  username: string;
  password: string;
  verifyCode?: string;
  authContext: OaAuthContext;
};

const postOaAuth = async <T,>(endpoint: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OA auth failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

const authPayload = (authContext: OaAuthContext, extra: Record<string, unknown> = {}) => ({
  ...authContext,
  authContext,
  ...extra,
});

export const getOaSession = (authContext: OaAuthContext, endpoint = '/api/agent/oa/session') =>
  postOaAuth<OaSessionStatus>(endpoint, authPayload(authContext));

export const loginOa = ({ username, password, verifyCode, authContext }: OaLoginInput, endpoint = '/api/agent/oa/login') =>
  postOaAuth<OaSessionStatus>(
    endpoint,
    authPayload(authContext, {
      username,
      password,
      verifyCode,
    }),
  );

export const logoutOa = (authContext: OaAuthContext, endpoint = '/api/agent/oa/logout') =>
  postOaAuth<OaSessionStatus>(endpoint, authPayload(authContext));
