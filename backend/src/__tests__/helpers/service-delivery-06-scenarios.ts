// ============================================
// backend/src/__tests__/helpers/service-delivery-06-scenarios.ts
//
// The service-delivery-06 scenarios:
//   • optional catalog reference (service_offering_id NULL allowed)
//   • free-text session_type persistence
//   • constraint chk_service_delivery_has_service enforcement
// ============================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setupServiceDelivery05, WS, type Run } from './service-delivery-05-scenarios'

export type { Run }

export interface Scenario {
  name: string
  run: (run: Run) => Promise<void>
}

const DOCS = join(__dirname, '..', '..', '..', '..', 'docs')
const doc = (name: string) => readFileSync(join(DOCS, name), 'utf8')

const CUST = 'c0000000-0000-4000-8000-000000000001'
const SERVICE = '20000000-0000-4000-8000-000000000001'

export async function setupServiceDelivery06(run: Run): Promise<void> {
  await setupServiceDelivery05(run)
  // Run migration 06 twice to prove idempotency
  await run(doc('service-delivery-06-optional-service-offering-migration.sql'))
  await run(doc('service-delivery-06-optional-service-offering-migration.sql'))
}

export const scenarios06: readonly Scenario[] = [
  {
    name: '1. Allows inserting session with NULL service_offering_id when session_type is present',
    run: async (run) => {
      const id = '60000000-0000-4000-8000-000000000001'
      await run(
        `INSERT INTO public.service_delivery_sessions (
           id, workspace_id, customer_id, service_offering_id, session_type, session_date, start_time, end_time
         ) VALUES ($1, $2, $3, NULL, $4, '2026-11-23', '09:00', '10:00')`,
        [id, WS, CUST, 'مشاوره اختصاصی'],
      )
      const rows = await run(
        `SELECT service_offering_id, session_type FROM public.service_delivery_sessions WHERE id = $1`,
        [id],
      )
      assert.equal(rows.length, 1)
      assert.equal(rows[0]?.service_offering_id, null)
      assert.equal(rows[0]?.session_type, 'مشاوره اختصاصی')
    },
  },
  {
    name: '2. Allows inserting session with catalog service_offering_id and NULL session_type',
    run: async (run) => {
      const id = '60000000-0000-4000-8000-000000000002'
      await run(
        `INSERT INTO public.service_delivery_sessions (
           id, workspace_id, customer_id, service_offering_id, session_type, session_date, start_time, end_time
         ) VALUES ($1, $2, $3, $4, NULL, '2026-11-23', '10:00', '11:00')`,
        [id, WS, CUST, SERVICE],
      )
      const rows = await run(
        `SELECT service_offering_id, session_type FROM public.service_delivery_sessions WHERE id = $1`,
        [id],
      )
      assert.equal(rows.length, 1)
      assert.equal(rows[0]?.service_offering_id, SERVICE)
      assert.equal(rows[0]?.session_type, null)
    },
  },
  {
    name: '3. Rejects session with both NULL service_offering_id and NULL session_type',
    run: async (run) => {
      const id = '60000000-0000-4000-8000-000000000003'
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_sessions (
             id, workspace_id, customer_id, service_offering_id, session_type, session_date, start_time, end_time
           ) VALUES ($1, $2, $3, NULL, NULL, '2026-11-23', '11:00', '12:00')`,
          [id, WS, CUST],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /chk_service_delivery_has_service/i)
      }
      assert.equal(
        failed,
        true,
        'must reject when both service_offering_id and session_type are null',
      )
    },
  },
  {
    name: '4. Rejects session with NULL service_offering_id and empty whitespace session_type',
    run: async (run) => {
      const id = '60000000-0000-4000-8000-000000000004'
      let failed = false
      try {
        await run(
          `INSERT INTO public.service_delivery_sessions (
             id, workspace_id, customer_id, service_offering_id, session_type, session_date, start_time, end_time
           ) VALUES ($1, $2, $3, NULL, '   ', '2026-11-23', '13:00', '14:00')`,
          [id, WS, CUST],
        )
      } catch (err: unknown) {
        failed = true
        assert.match(String(err), /chk_service_delivery_has_service/i)
      }
      assert.equal(failed, true, 'must reject when session_type is whitespace-only')
    },
  },
]
