# Failure Verification

### Total Verified Failures: 21

1. **active-workspace-travels.test.ts (Line 137)**
   - Test: `an approved MCP action runs in the workspace it was approved in`
   - Received: `...request.tenancy.workspaceId)`
   - Expected: `request.tenancy.workspaceId, )`
   - Classification: **TEST BUG** (Fragile string assertion requiring trailing comma)
   - Runtime Product Bug: **0**

2. **rtl-logical-properties.test.ts (Line 188)**
   - Test: `no new ml-/pr-/left-/border-l/rounded-r/text-left outside the documented exceptions`
   - Received: 10 physical layout occurrences in apps/admin/components/cms
   - Expected: Empty list
   - Classification: **TEST/LINT BUG** (New CMS pages lack logical RTL utility classes)

3. **parity.test.ts in @hisabche/design-tokens (19 failures)**
   - Failures: Decimal precision mismatch (`0.8` vs `0.80`), color token mismatch, missing light theme selector in globals.css
   - Classification: **TEST BUG** (Out-of-sync design tokens test assertions)
