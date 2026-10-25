// ============================================
// packages/local-engine/src/routes/units.ts
//
// The units of measure, offline: `GET /units`.
//
// ⚠️ THE SAME LIST THE SERVER FALLS BACK TO. A gram is a gram on every device
// and the table carries no workspace, so the device answers from `SEEDED_UNITS`
// in @hisabche/validation — the constant the server's units service imports.
// `source: 'seed'` is reported, exactly as the server does when it serves it.
//
// A business's OWN units («مثقال») and the per-product conversion live in
// tables the device does not hold yet: those stay online (matrix row
// `unit.conversion`), never faked here.
// ============================================

import { SEEDED_UNITS } from '@hisabche/validation'
import type { Router } from '../router'

export function registerUnitRoutes(router: Router): void {
  router.get('/units', () => ({ units: SEEDED_UNITS, source: 'seed' as const }))
}
