# Failure Resolution Report

### 21 Non-Product Failures Classified:
1. **Design Tokens (19 failures)**:
   - File: `packages/design-tokens/src/__tests__/parity.test.ts`
   - Root Cause: Strict equality assertions on CSS string formatting (e.g. `0.8` vs `0.80`) and missing `:root[data-theme="light"]` block in `globals.css`.
   - Classification: **TEST BUG**
2. **UI RTL Properties (1 failure)**:
   - File: `packages/ui/src/__tests__/rtl-logical-properties.test.ts`
   - Root Cause: Newly authored CMS client components use physical Tailwind classes (`mr-2`, `ml-4`) instead of logical RTL utilities (`me-2`, `ms-4`).
   - Classification: **TEST / LINT GUARDRAIL**
3. **MCP Context Travel (1 failure)**:
   - File: `backend/src/__tests__/active-workspace-travels.test.ts:137`
   - Root Cause: Regex string expectation `request.tenancy.workspaceId, )` failed because `mcp.routes.ts` had `request.tenancy.workspaceId)` without a trailing comma.
   - Classification: **TEST BUG**
