# Ecosystem & Workflow

## عنوان

Ecosystem & Workflow (market, commerce, extensions, plugins, connectors, developer, oauth, automation, workflow, rules)

## توضیحات

This domain handles the extensibility, integrations, and automation engines of the platform. It includes the developer portal, marketplace, OAuth flows, and robust workflow and rule engines for approvals and escalations.

## Backend

- `backend/src/services/market` (market.service.ts)
- `backend/src/services/oauth` (oauth.domain.ts, marketplace.service.ts, oauth.repository.ts, oauth.service.ts)
- `backend/src/services/extensions` (extension.domain.ts, custom-fields.service.ts)
- `backend/src/services/plugins` (plugin.domain.ts)
- `backend/src/services/developer` (developer.domain.ts, developer.repository.ts, developer.service.ts, sandbox.service.ts)
- `backend/src/services/workflow` (approval-gate.domain.ts, approval.domain.ts, builder.domain.ts, compensation.service.ts, escalation.domain.ts, escalation.service.ts)
- `backend/src/services/rules` (rules.domain.ts, rules.service.ts)

## Frontend

- **UI Components:** `packages/ui/src/components/ui/workflow/` (approval-actions.tsx, approval-timeline.tsx, approvals-view.tsx, escalation-policy-editor.tsx, workflow-templates-view.tsx)
- **Libs:** `packages/ui/src/lib/oauth-labels.ts`
- **App Shell Features:** `packages/app-shell/src/features/` (`approvals`, `developers`, `market`, `marketplace`)
- **Web App Public Routes:** `apps/web/app/[lang]/market`, `apps/web/app/[lang]/oauth`
- **Web App Dashboard Routes:** `apps/web/app/[lang]/(dashboard)/approvals`, `apps/web/app/[lang]/(dashboard)/developers`, `apps/web/app/[lang]/(dashboard)/market-seller`, `apps/web/app/[lang]/(dashboard)/marketplace`

## Database

- **Enums:** `workflow_status`, `workflow_action`
- **Tables:** `workflows`, `workflow_steps`, `workflow_instances`, `workflow_actions`

## Tests

- **Backend Tests:** `approval-gate.test.ts`, `approval-routing.test.ts`, `automation-schedule.test.ts`, `automation-service.test.ts`, `connector-framework.test.ts`, `developer-platform.test.ts`, `escalation-and-compensation.test.ts`, `extension-boundary-guard.test.ts`, `goods-marketplace.test.ts`, `marketplace.test.ts`, `oauth.test.ts`, `sandbox.test.ts`, `workflow-builder.test.ts`, `rules-engine-rules.test.ts`
- **Frontend Tests:** `oauth-screens.test.ts`, `marketplace-screens.test.ts`, `goods-marketplace-pages.test.ts`, `workflow-escalation-ui.test.ts`, `approvals-hub.test.ts`, `developers-screen.test.ts`, `sandbox-screens.test.ts`

## Status

Implemented (Active Development / Testing)
