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

## Local Quality Checks

Run the pinned OA public-event contract hash check, type checking, tests, lint, format checking, and
build locally before handing off a change. The repository's CI/CD and deployment policy are outside
the current agent architecture work.

The versioned backend event schema and fixture are copied under `contracts/`. Any intentional contract update must copy
both backend artifacts, update `contracts/SHA256SUMS`, and update the parser contract tests in the same change. The
checked-in hashes make an unsynchronized schema or fixture change fail during local verification.

In development, `/api` is proxied to `http://localhost:8081` by Vite. Override it with `VITE_AGENT_API_BASE_URL` only when you intentionally want the browser to call another backend origin directly.

The header diagnostics dialog reads the backend's sanitized `/api/health` development diagnostics
and shows the current public trace/task identifiers. It does not depend on build revision pairing and
never renders raw tool payloads or private prompts.
