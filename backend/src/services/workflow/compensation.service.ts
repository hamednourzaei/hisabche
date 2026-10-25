// ============================================
// Capability #81 — undo/compensation, as something the client can ASK ABOUT.
//
// The route → command table and the warning rule live in `@hisabche/validation`
// (schemas/compensation-plan.ts) so the offline engine answers the SAME
// question from the SAME table. This file keeps the old import path working.
// ============================================

export { COMPENSATION_BY_ROUTE, compensationForRoute, requiresWarning } from '@hisabche/validation'
