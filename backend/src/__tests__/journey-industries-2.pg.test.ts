// ============================================
// backend/src/__tests__/journey-industries-2.pg.test.ts
//
// Shard 2 of the per-trade first day on a REAL PostgreSQL (V64 §2.8 POSTGRES_JOURNEY).
// What it proves and how: helpers/industry-journey.ts. Which trades: journeyShardOf().
// ============================================

import { vi } from 'vitest'
import { industryJourney } from './helpers/industry-journey'

vi.mock('../db', async () => (globalThis as typeof globalThis & Record<string, object>).__journeyDb)

industryJourney(2)
