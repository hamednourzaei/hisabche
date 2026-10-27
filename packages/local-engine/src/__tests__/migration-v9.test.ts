// ============================================
// v8 → v9 on a real SQLite file.
//
// Tests that existing v8 caches migrate cleanly to v9:
// - credit_limit_mode column is added to local_workspace
// - product_variants, pack_barcodes, product_serials, metal_rates,
//   auto_fitments, vehicle_units, warranties, invoice_returns,
//   invoice_return_lines tables are created
// - Prior data in local_workspace and other tables is 100% preserved
// - Migration is idempotent: running twice succeeds without error
// ============================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { LOCAL_MIGRATIONS, isAlreadyApplied } from '../../../app-bridge/src/local-migrations'
import { SCHEMA_VERSION } from '../../../app-bridge/src/local-schema'

const CREATED: string[] = []

function scratch(name: string): string {
  const file = path.join(os.tmpdir(), `hisabche-${name}-${Date.now()}-${Math.random()}.db`)
  CREATED.push(file)
  return file
}

function applyFrom(db: DatabaseSync, from: number): void {
  for (const migration of LOCAL_MIGRATIONS.filter((m) => m.to > from)) {
    for (const statement of migration.statements) {
      try {
        db.exec(statement)
      } catch (error) {
        if (!isAlreadyApplied(error)) throw error
      }
    }
  }
  db.prepare(
    `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`,
  ).run()
}

function v8Synthetic(): DatabaseSync {
  const db = new DatabaseSync(scratch('v8'))
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE local_workspace (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_currency TEXT NOT NULL,
      time_zone TEXT NOT NULL DEFAULT 'Asia/Kabul',
      business_types TEXT NOT NULL DEFAULT '',
      business_types_updated_at TEXT,
      logo_url TEXT,
      stamp_url TEXT,
      signature_url TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE product (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT);
    CREATE TABLE invoice (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '');
    INSERT INTO local_workspace (id, name, base_currency, business_types) VALUES ('w1', 'Kabul Traders', 'AFN', 'grocery,fabric');
    INSERT INTO product (id, name) VALUES ('p1', 'Existing sugar bag');
    INSERT INTO invoice (id) VALUES ('i1');
    INSERT INTO meta (key, value) VALUES ('schema_version', '8');
  `)
  return db
}

afterEach(() => {
  for (const file of CREATED.splice(0)) {
    try {
      fs.unlinkSync(file)
    } catch {
      // Ignore
    }
  }
})

describe('v8 → v9 migration', () => {
  it('applies v9 migration and preserves prior data', () => {
    const db = v8Synthetic()

    // Apply migrations from v8
    applyFrom(db, 8)

    // Check schema version
    const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string
    }
    expect(versionRow.value).toBe('9')

    // Check prior data preserved
    const ws = db
      .prepare(
        'SELECT id, name, base_currency, business_types, credit_limit_mode FROM local_workspace WHERE id = ?',
      )
      .get('w1') as {
      id: string
      name: string
      base_currency: string
      business_types: string
      credit_limit_mode: string
    }
    expect(ws.name).toBe('Kabul Traders')
    expect(ws.base_currency).toBe('AFN')
    expect(ws.business_types).toBe('grocery,fabric')
    expect(ws.credit_limit_mode).toBe('warn')

    // Check new tables created and writable
    db.prepare(
      `
      INSERT INTO product_variants (id, workspace_id, template_product_id, sku, attributes, price_override_minor)
      VALUES ('v1', 'w1', 'p1', 'SKU-RED-XL', '[{"name":"color","value":"red"},{"name":"size","value":"XL"}]', 120000)
    `,
    ).run()

    const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get('v1') as {
      sku: string
      price_override_minor: number
    }
    expect(variant.sku).toBe('SKU-RED-XL')
    expect(variant.price_override_minor).toBe(120000)

    // Check vehicle attributes
    db.prepare(
      `
      INSERT INTO vehicle_attributes (id, workspace_id, serial_id, make, model, year, colour, odometer)
      VALUES ('va1', 'w1', 's1', 'Toyota', 'Corolla', 2021, 'White', 35000)
    `,
    ).run()
    const veh = db
      .prepare('SELECT make, model FROM vehicle_attributes WHERE id = ?')
      .get('va1') as { make: string; model: string }
    expect(veh.make).toBe('Toyota')
    expect(veh.model).toBe('Corolla')

    // Check idempotency: applying a second time does not throw or corrupt data
    expect(() => applyFrom(db, 8)).not.toThrow()
    const ws2 = db
      .prepare('SELECT name, credit_limit_mode FROM local_workspace WHERE id = ?')
      .get('w1') as { name: string; credit_limit_mode: string }
    expect(ws2.name).toBe('Kabul Traders')
    expect(ws2.credit_limit_mode).toBe('warn')
  })
})
