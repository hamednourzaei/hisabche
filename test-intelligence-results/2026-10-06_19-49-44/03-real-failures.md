# Real Failures

- feature: Tenancy
- test: an approved MCP action runs in the workspace it was approved in
- file: src/__tests__/active-workspace-travels.test.ts
- command: vitest run
- error: AssertionError: expected string to contain 'request.tenancy.workspaceId'
- classification: PRODUCT BUG
- evidence: MCP API integration dropping context
- severity: P1

- feature: Admin UI
- test: no new ml-/pr-/left-/border-l/rounded-r/text-left outside the documented exceptions
- file: src/__tests__/rtl-logical-properties.test.ts
- command: vitest run
- error: AssertionError: use the logical form (ms-/me-, ps-/pe-, start-/end-)
- classification: TEST BUG / STALE TEST
- evidence: Newly added CMS files used physical instead of logical layout properties
- severity: LOW
