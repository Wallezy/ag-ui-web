# OA V2 Frontend Compatibility and Rollback

The frontend treats `oa.public_agent_event` schema 2 as optional display state. It never uses a
public event as permission, write confirmation, identity, or business-success authority. The legacy
`execution_progress` stream remains the fallback.

## Compatibility matrix

| Backend | Frontend | Result |
|---|---|---|
| V1 only | current | V2 cards are absent; v1 progress and tools remain functional |
| V2 schema 2 | current | understanding, clarification, field correction, and repair timeline render |
| unknown V2 schema | current | strict parser ignores the event; v1 remains functional |
| V2 schema 2 | older | additive custom event is ignored; v1 remains functional |

Clarification controls render only when a bounded `questionId` is present and the question kind is
not `WRITE_CONFIRMATION`. Option answers and free text are sent as one-shot `oaTaskDelta` data in
`forwardedProps`; retries are bound to the same source message ID. Field editing permits only the
frontend business-slot allowlist. Tenant, user, session, permission, and confirmation fields are not
editable.

## Release checks

Use Node 22.13 or newer (Node 24 is the tested release runtime) and pnpm 11.10.0:

```bash
node --version
pnpm --version
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
git rev-parse HEAD
```

Record the frontend build SHA beside the backend build, public-event schema, policy, calibration,
and dataset versions in the release ticket. Validate both mixed-version rows in the compatibility
matrix before increasing backend execution traffic.

## Monitoring and rollback

Monitor rejected V2 envelopes, stale/duplicate event counts, clarification submit failures, HTTP 409
version conflicts, and the share of sessions falling back to v1. Do not log free text, raw tool data,
or task-delta values.

Rollback the backend behavior in the order documented in
`agent-platform/docs/operations/oa-v2-rollout-runbook.md`. The frontend requires no emergency data
migration: disabling backend public events removes the V2 panels on the next run while v1 progress
continues. If the frontend itself must be rolled back, deploy the previous immutable build; the
backend must retain v1 and additive schema-2 events for at least two stable releases.
