IMPORTANT — ADMIN UI MUST BE A SELF-CONTAINED COPY OF THE EXISTING SHARED UI
The goal of this task is NOT to import UI components from `packages/ui`.
Instead:
`packages/ui` is the SOURCE / REFERENCE implementation.
`apps/admin` must contain its OWN local copies of the required UI components, copied/adapted from the existing implementations in:
packages/ui/
After this migration, the Admin application MUST NOT import UI components directly from `@hisabche/ui` or `packages/ui`.
CORE REQUIREMENT
Use the existing:
packages/ui
as the canonical visual and behavioral reference.
Inspect the existing components and recreate/copy the required implementations into:
apps/admin/
The resulting Admin UI must look and behave the same as the existing Hisabche UI.
However, the Admin application must own its local UI implementation.
Architecture:
packages/ui ↓ SOURCE / REFERENCE ONLY
apps/admin ↓ LOCAL COPIES OF REQUIRED UI ↓ Admin runtime
There must be NO runtime dependency from Admin UI components to packages/ui.
IMPORTANT DISTINCTION
DO NOT do this:
import { Button } from "@hisabche/ui"
DO NOT do this:
import { DashboardSidebar } from "@hisabche/ui"
DO NOT do this:
import DashboardSidebar from "../../../packages/ui/..."
Instead, copy/adapt the actual implementation into the Admin application.
For example:
packages/ui/src/components/ui/button.tsx
→
apps/admin/components/ui/button.tsx
and:
packages/ui/src/components/ui/dashboard-sidebar.tsx
→
apps/admin/components/ui/dashboard-sidebar.tsx
The Admin version must be locally owned.
WHAT MUST BE COPIED
First inspect the current Admin application and determine which UI components it currently uses.
For every UI component required by Admin:

1. Find the corresponding implementation in packages/ui.
2. Copy its implementation into the appropriate Admin local component directory.
3. Preserve its visual behavior.
4. Preserve accessibility behavior.
5. Preserve responsive behavior.
6. Preserve RTL/LTR behavior.
7. Preserve variants and states that Admin actually uses.
8. Adapt only imports that point to packages/ui internals.
9. Replace those imports with Admin-local equivalents where necessary.

Do NOT blindly copy the entire packages/ui package.
Copy ONLY the components and supporting primitives actually required by Admin.
DEPENDENCIES BETWEEN COMPONENTS
If a copied component depends on another UI component from packages/ui:
Example:
DashboardSidebar ↓ Button ↓ Tooltip
then copy the required dependency chain into:
apps/admin/components/ui/
and make the Admin-local components import from each other.
Example:
apps/admin/components/ui/dashboard-sidebar.tsx ↓ apps/admin/components/ui/button.tsx ↓ apps/admin/components/ui/tooltip.tsx
Do NOT leave hidden imports back to packages/ui.
DESIGN TOKENS
The Admin UI should visually match the existing Hisabche design.
Copy/reuse the existing design-token VALUES from packages/ui where necessary.
Do NOT invent new colors, spacing, typography, radius, shadows, etc.
The Admin implementation should preserve the existing:

- colors
- semantic tokens
- typography
- spacing
- radii
- shadows
- states
- animations
- responsive behavior
- RTL behavior

But Admin should own the implementation.
I18N
The Admin UI MUST still use the existing Hisabche i18n infrastructure.
Do NOT copy the entire i18n system.
Do NOT create a second translation system.
The copied UI components may use:
useTranslations()
or the existing i18n APIs exactly as the source components do.
Ensure the Admin root provides the correct existing NextIntlClientProvider.
Supported locales:
fa en
fa → RTL en → LTR
All user-facing text must remain translated.
Do NOT hardcode:
Login Dashboard Admin Email Password Loading Error etc.
AUTH COMPONENTS
If Admin currently uses shared authentication components from packages/ui:
Use packages/ui as the reference implementation.
Copy the required auth components into:
apps/admin/components/ui/auth/
or another appropriate local Admin directory.
Then adapt them so they are fully self-contained.
Do NOT import the original auth component from packages/ui.
DASHBOARD COMPONENTS
If Admin currently uses:
DashboardSidebar DashboardHeader DashboardLayout Card Button etc.
copy the required implementations into Admin-local components.
For example:
apps/admin/components/ui/dashboard-sidebar.tsx apps/admin/components/ui/dashboard-header.tsx apps/admin/components/ui/button.tsx apps/admin/components/ui/card.tsx
Again:
packages/ui = reference
apps/admin = runtime implementation
DO NOT CHANGE VISUAL DESIGN
This is a COPY/PARITY task.
Do NOT redesign anything.
Do NOT modernize anything.
Do NOT simplify anything.
Do NOT create a different Admin visual language.
The copied Admin components should visually match their packages/ui source counterparts.
DO NOT COPY UNNECESSARY COMPONENTS
Do NOT copy all of packages/ui.
Only copy the dependency graph required by the current Admin application.
Do NOT create future Users/Payments/Subscriptions/Billing UI.
Do NOT add new dashboard features.
Do NOT add new pages.
Do NOT add new functionality.
NO CROSS-IMPORTS
After the migration, run a search through apps/admin.
There must be NO imports such as:
@hisabche/ui packages/ui ../../../packages/ui ../../packages/ui
for Admin UI components.
If a copied component still imports a shared UI component, resolve it by copying that required dependency locally.
Shared non-UI infrastructure may remain shared only if it is explicitly required and does not violate the local UI requirement.
IMPORTANT: DO NOT DUPLICATE BUSINESS LOGIC
This requirement applies ONLY to UI.
Do NOT duplicate:
Supabase authentication logic Admin authorization logic Backend API logic Business services Database logic Admin API guard i18n infrastructure
Those should continue using the existing architecture.
Only the UI implementation should become locally owned.
CLEANUP
After copying the components:

1. Update Admin imports to local components.
2. Remove unused imports from packages/ui.
3. Remove unused local placeholder UI components.
4. Do NOT delete anything from packages/ui.
5. Do NOT modify apps/web unnecessarily.

The packages/ui source must remain intact because it is still the reference implementation for the main product.
VERIFICATION
Run:
pnpm type-check pnpm lint pnpm build
Then verify:

1. Admin builds successfully.
2. Login works.
3. Dashboard works.
4. Sidebar works.
5. Header works.
6. Authentication still works.
7. ADMIN_ALLOWED_EMAILS still works.
8. Admin API still works.
9. fa works.
10. en works.
11. fa is RTL.
12. en is LTR.
13. No NextIntlClientProvider missing-context error.
14. No hardcoded user-facing strings.
15. No Admin UI imports from packages/ui.
16. Admin UI remains visually/behaviorally equivalent to packages/ui.

Search specifically for forbidden imports:
@hisabche/ui packages/ui ../../packages/ui ../../../packages/ui
There must be no UI imports from those locations inside apps/admin.
STRICT RULES
DO NOT:

- create a new design system
- redesign the UI
- create new features
- create new pages
- create Users UI
- create Businesses UI
- create Payments UI
- create Subscriptions UI
- create Billing UI
- create Audit UI
- create a new authentication system
- create a new i18n system
- duplicate backend logic
- modify unrelated applications
- add unnecessary dependencies
- use `any`
- disable TypeScript
- disable ESLint
- suppress errors

The only architectural change requested here is:
packages/ui ↓ COPY / ADAPT ↓ apps/admin local UI
No runtime UI dependency from apps/admin back to packages/ui.
FINAL RESPONSE ONLY
Typecheck: PASS/FAIL Lint: PASS/FAIL Build: PASS/FAIL (exit code X) Runtime: PASS/FAIL i18n: PASS/FAIL RTL/LTR: PASS/FAIL UI parity with packages/ui: PASS/FAIL Admin UI independent from packages/ui: PASS/FAIL
Local UI components created:

- ...

Files changed:

- ...

Forbidden packages/ui imports remaining:

- ...

Remaining blockers:

- ...
