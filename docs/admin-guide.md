STOP.

You are currently interpreting the task incorrectly.

The task is NOT to create docs/admin-guide.md.
Do NOT modify or create any documentation files.

The ONLY task is the Admin UI migration described by:
docs/ADMIN_UI_COPY_TASK.md

Before making ANY changes:

1. Read the COMPLETE contents of:
   docs/ADMIN_UI_COPY_TASK.md

2. Read:
   CLAUDE.md

3. Inspect:
   apps/admin
   packages/ui

4. Identify the exact UI components currently used by apps/admin.

5. For every required UI component, locate its canonical implementation in packages/ui.

IMPORTANT ARCHITECTURE:

packages/ui = SOURCE / REFERENCE ONLY

apps/admin = SELF-CONTAINED LOCAL UI IMPLEMENTATION

You MUST COPY/ADAPT the actual UI implementations from packages/ui into apps/admin.

Do NOT import UI components from packages/ui.

Forbidden examples:

import { Button } from "@hisabche/ui"
import { DashboardSidebar } from "@hisabche/ui"
import DashboardSidebar from "../../../packages/ui/..."

Instead create local implementations such as:

apps/admin/components/ui/button.tsx
apps/admin/components/ui/dashboard-sidebar.tsx

If a copied component depends on another packages/ui component, copy that dependency locally too.

Do NOT copy the entire packages/ui package.
Copy ONLY the dependency graph actually required by apps/admin.

Do NOT redesign anything.
Do NOT create a new design system.
Do NOT invent new UI.
Do NOT create new pages.
Do NOT create documentation.
Do NOT modify unrelated apps.

Preserve exactly:

- visual design
- spacing
- typography
- colors/tokens
- variants
- states
- animations
- responsive behavior
- RTL/LTR behavior
- accessibility behavior

Keep these shared and DO NOT duplicate them:

- Supabase auth
- admin authorization
- backend API
- business logic
- database logic
- i18n infrastructure

The ONLY thing being made local is the UI implementation.

After implementation, search the entire apps/admin directory for forbidden imports:

@hisabche/ui
packages/ui
../../packages/ui
../../../packages/ui

There must be ZERO UI imports from packages/ui.

Then run:

pnpm type-check
pnpm lint
pnpm build

Finally verify:

- /login works
- /dashboard works
- authentication works
- ADMIN_ALLOWED_EMAILS works
- Admin API works
- fa works
- en works
- fa is RTL
- en is LTR
- NextIntlClientProvider is correctly configured
- no hardcoded user-facing strings
- no missing-context error
- UI matches packages/ui
- apps/admin has no runtime UI dependency on packages/ui

Do not start implementing until you have inspected the task file and repository.

Do not create docs/admin-guide.md.
Do not modify any documentation.

At the end, report ONLY:

Typecheck: PASS/FAIL
Lint: PASS/FAIL
Build: PASS/FAIL
Runtime: PASS/FAIL
i18n: PASS/FAIL
RTL/LTR: PASS/FAIL
UI parity: PASS/FAIL
Admin UI independent from packages/ui: PASS/FAIL

Local UI components created:

- ...

Files changed:

- ...

Forbidden packages/ui imports remaining:

- ...

Remaining blockers:

- ...
