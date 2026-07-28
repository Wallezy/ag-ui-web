# OA V2 frontend reaudit baseline - 2026-07-25

## Source snapshot

- Branch: `github-dev`
- Starting HEAD: `6f79dcea8a5f937faed6ec1c3d36c6f8e35ca4a0`
- Audited HEAD: `6f79dcea8a5f937faed6ec1c3d36c6f8e35ca4a0`
- Starting worktree: clean
- Runtime: Node 24 bundled runtime, pnpm 11.10.0

The local `github-dev` branch and `github/github-dev` were identical. No commits newer
than the audited snapshot were present.

## Quality baseline

Commands:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

All commands passed. The test suite ran 91 tests with 0 failures and 0 skips. The production
build completed with a non-blocking warning for a JavaScript chunk larger than 500 kB.

## CI baseline

The repository has GitLab CI configuration and no GitHub Actions workflow. The install job
currently requires only frozen install, tests, and build. It does not separately require
typecheck, lint, format checking, or a versioned backend/frontend protocol contract gate.
Those gaps are assigned to `CI-02`.

Hosted GitLab branch rules are not represented in this checkout and were not asserted by
this baseline.

## Scope

This baseline changes documentation only and does not alter UI or protocol behavior.
