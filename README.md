# Agent Platform Web

Standalone frontend for the Java Agent Platform.

The project is now a single Vite + React app. There is no apps/packages workspace layer.

## Main Folders

- `src/features/agents`: weather agent, project management agent, AG-UI integration
- `src/components`: app shell, assistant-ui, and UI primitives
- `src/routes`: route entries

## Commands

```powershell
corepack pnpm@11.10.0 install
corepack pnpm@11.10.0 dev -- --host 127.0.0.1
corepack pnpm@11.10.0 typecheck
corepack pnpm@11.10.0 build
```

In development, `/api` is proxied to `http://localhost:8081` by Vite. Override it with `VITE_AGENT_API_BASE_URL` only when you intentionally want the browser to call another backend origin directly.
