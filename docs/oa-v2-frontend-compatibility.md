# OA V2 Frontend Compatibility

The frontend treats `oa.public_agent_event` schemas 2 and 3 as optional display state. It never uses a
public event as permission, write confirmation, identity, or business-success authority. The legacy
`execution_progress` stream remains the fallback.

## Compatibility matrix

| Backend | Frontend | Result |
|---|---|---|
| V1 only | current | V2 cards are absent; v1 progress and tools remain functional |
| V2 schema 2 | current | legacy V2 understanding, clarification, correction, and repair timeline render |
| V2 schema 3 | current | typed slot values, source/status, correction, and repair timeline render |
| V2 dual emit 3+2 | current | shared event ID is deduplicated; schema 3 is authoritative for display |
| unknown V2 schema | current | strict parser ignores the event; v1 remains functional |
| V2 schema 2 | older | additive custom event is ignored; v1 remains functional |

Clarification controls render only when a bounded `questionId` is present and the question kind is
not `WRITE_CONFIRMATION`. Option answers and free text are sent as one-shot `oaTaskDelta` data in
`forwardedProps`; retries are bound to the same source message ID. Field editing permits only the
frontend business-slot allowlist. Tenant, user, session, permission, and confirmation fields are not
editable.

## Local checks

Use Node 22.13 or newer and pnpm 11.10.0:

```bash
node --version
pnpm --version
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

Validate the mixed-version rows in the compatibility matrix when changing the backend event schema.
A version mismatch or unknown future schema is ignored and falls back to v1; it never authorizes
execution.

## Diagnostics and fallback

Inspect rejected V2 envelopes, stale/duplicate event counts, clarification submit failures, HTTP 409
version conflicts, and the share of sessions falling back to v1. Do not log free text, raw tool data,
or task-delta values.

Disabling backend public events removes the V2 panels on the next run while v1 progress continues.
The backend should retain v1 and additive schema-2 events while older development clients remain in
use.

Frontend fallback never discards, rewrites, or supersedes authoritative backend TaskState. In
particular, a correction already accepted by the backend remains the current value even when the UI
falls back to schema 2 or v1. The frontend has no authority over tool selection, completion,
permissions, confirmation, idempotency, audit, or `COMMIT_UNKNOWN` handling.
