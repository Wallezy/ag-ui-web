# Development Stable Frontend Baseline - 2026-07-26

## Immutable source

- Branch at capture: `github-dev`
- Frontend revision: `1a0fc2f5eb06994bd1675bfd94e142c0a13a6df6`
- Worktree: clean before capture
- Node: `22.20.0`
- pnpm: `11.10.0`

## Baseline verification

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

All commands passed. The test suite ran 98 tests with no failures or skips. The production build
retains the existing large-chunk warning and completed successfully.

## Stable compatibility boundary

The frontend supports public event schemas v2 and v3, deduplicates dual-emitted events, and ignores
unknown versions. TaskDelta supports success, fixed-source retry, conflict rebase, unknown outcome,
and explicit discard. It does not own intent execution, tool selection, permissions, confirmation,
idempotency, audit, or task completion.

The development stable release keeps entity probe, Fast-to-Repair, agentic recovery, and execution
canaries disabled on the backend. Writes remain previewed and page-confirmed.
