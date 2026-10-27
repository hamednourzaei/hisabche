// Copies the INSTALLED desktop database and runs the v7 → v8 migration on the
// copy. The live file is never opened for writing.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { LOCAL_MIGRATIONS, isAlreadyApplied } from '../packages/app-bridge/src/local-migrations.ts'

const live = path.join(os.homedir(), 'AppData', 'Roaming', '@hisabche', 'desktop', 'hisabche.db')
if (!fs.existsSync(live)) {
  console.error(`INSTALLED_DB_NOT_FOUND: ${live}`)
  process.exit(2)
}
const copy = path.join(os.tmpdir(), `hisabche-migration-${Date.now()}.db`)
fs.copyFileSync(live, copy)
console.log(`copy: ${copy}`)
console.log(`live untouched: ${live}`)

const db = new DatabaseSync(copy)
const versionRow = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
const before = Number(versionRow?.value ?? 0)
const wsBefore = db.prepare('SELECT COUNT(*) AS n FROM local_workspace').get()
const productBefore = db.prepare('SELECT COUNT(*) AS n FROM product').get()
const invoiceBefore = db.prepare('SELECT COUNT(*) AS n FROM invoice').get()
console.log(
  `before version=${before} workspaces=${wsBefore.n} products=${productBefore.n} invoices=${invoiceBefore.n}`,
)

function apply() {
  for (const migration of LOCAL_MIGRATIONS.filter((m) => m.to > before)) {
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

apply()
apply()

const columns = db
  .prepare("PRAGMA table_info('local_workspace')")
  .all()
  .map((r) => r.name)
const unitColumns = db
  .prepare("PRAGMA table_info('product_units')")
  .all()
  .map((r) => r.name)
const versionAfter = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
const wsAfter = db.prepare('SELECT COUNT(*) AS n FROM local_workspace').get()
const productAfter = db.prepare('SELECT COUNT(*) AS n FROM product').get()
const invoiceAfter = db.prepare('SELECT COUNT(*) AS n FROM invoice').get()

console.log(
  `after version=${versionAfter.value} workspaces=${wsAfter.n} products=${productAfter.n} invoices=${invoiceAfter.n}`,
)
console.log(`business_types present=${columns.includes('business_types')}`)
console.log(`business_types_updated_at present=${columns.includes('business_types_updated_at')}`)
console.log(`product_units columns=${unitColumns.join(',')}`)

const ok =
  Number(versionAfter.value) === 8 &&
  columns.includes('business_types') &&
  columns.includes('business_types_updated_at') &&
  unitColumns.includes('conversion_factor_to_base') &&
  wsAfter.n === wsBefore.n &&
  productAfter.n === productBefore.n &&
  invoiceAfter.n === invoiceBefore.n
console.log(ok ? 'MIGRATION_OK' : 'MIGRATION_FAILED')
db.close()
fs.unlinkSync(copy)
console.log(`copy removed: ${copy}`)
process.exit(ok ? 0 : 1)
