/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGUI_WEATHER_URL?: string
  readonly VITE_AGENT_API_BASE_URL?: string
  readonly VITE_OA_LOGIN_URL?: string
  readonly VITE_OA_LOGIN_REDIRECT_PARAM?: string
  readonly VITE_FRONTEND_REVISION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
