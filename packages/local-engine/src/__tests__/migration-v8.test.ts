// ============================================
// v7 → v8 on a real SQLite file.
//
// The migration runs on a machine nobody can reach, so it is exercised twice
// here: once on a synthetic v7 and once on a COPY of the installed desktop
// database, which is the file that actually has data in it.
// ============================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { LOCAL_MIGRATIONS, isAlreadyApplied } from '../../../app-bridge/src/local-migrations'

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
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '8')").run()
}

function v7Synthetic(): DatabaseSync {
  const db = new DatabaseSync(scratch('v7'))
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE local_workspace (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_currency TEXT NOT NULL,
      time_zone TEXT NOT NULL DEFAULT 'Asia/Kabul',
      logo_url TEXT,
      stamp_url TEXT,
      signature_url TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE product (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '', name TEXT);
    CREATE TABLE invoice (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL DEFAULT '');
    INSERT INTO local_workspace (id, name, base_currency) VALUES ('w1', 'Existing shop', 'AFN');
    INSERT INTO product (id, name) VALUES ('p1', 'Existing product');
    INSERT INTO invoice (id) VALUES ('i1');
    INSERT INTO meta (key, value) VALUES ('schema_version', '7');
  `)
  return db
}

afterEach(() => {
  for (const file of CREATED.splice(0)) {
    try {
      fs.unlinkSync(file)
    } catch {
      // The test may already have removed it; no second failure for cleanup.
    }
  }
})

describe('v8 industry and product units', () => {
  it('adds the columns and the table to a v7 cache, twice, keeping every row', () => {
    const db = v7Synthetic()
    applyFrom(db, 7)
    applyFrom(db, 7)

    const columns = db.prepare("PRAGMA table_info('local_workspace')").all() as Array<{
      name: string
    }>
    const names = columns.map((c) => c.name)
    expect(names).toContain('business_types')
    expect(names).toContain('business_types_updated_at')

    const units = db.prepare("PRAGMA table_info('product_units')").all() as Array<{ name: string }>
    expect(units.map((c) => c.name)).toContain('conversion_factor_to_base')
    expect(units.map((c) => c.name)).toContain('unit_code')

    expect((db.prepare('SELECT COUNT(*) AS n FROM local_workspace').get() as { n: number }).n).toBe(
      1,
    )
    expect((db.prepare('SELECT COUNT(*) AS n FROM product').get() as { n: number }).n).toBe(1)
    expect((db.prepare('SELECT COUNT(*) AS n FROM invoice').get() as { n: number }).n).toBe(1)
    expect(
      (
        db.prepare("SELECT business_types FROM local_workspace WHERE id = 'w1'").get() as {
          business_types: string
        }
      ).business_types,
    ).toBe('')
    db.close()
  })

  it.runIf(fs.existsSync(installedDb()))(
    'migrates a COPY of the installed desktop database',
    () => {
      const live = installedDb()
      const copy = scratch('installed')
      fs.copyFileSync(live, copy)
      const db = new DatabaseSync(copy)

      const before = db.prepare('SELECT COUNT(*) AS n FROM product').get() as { n: number }
      const beforeInvoices = db.prepare('SELECT COUNT(*) AS n FROM invoice').get() as { n: number }
      const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
        { value: string } | undefined
      const from = Number(version?.value ?? 0)
      applyFrom(db, from)
      applyFrom(db, from)

      const names = (
        db.prepare("PRAGMA table_info('local_workspace')").all() as Array<{ name: string }>
      ).map((c) => c.name)
      expect(names).toContain('business_types')
      expect((db.prepare('SELECT COUNT(*) AS n FROM product').get() as { n: number }).n).toBe(
        before.n,
      )
      expect((db.prepare('SELECT COUNT(*) AS n FROM invoice').get() as { n: number }).n).toBe(
        beforeInvoices.n,
      )
      db.close()
      expect(fs.existsSync(copy)).toBe(true)
    },
  )
})

function installedDb(): string {
  return path.join(os.homedir(), 'AppData', 'Roaming', '@hisabche', 'desktop', 'hisabche.db')
}
