// Run one file through the SAME inspection the import page uses
// (POST /api/migrations/inspect → inspectUpload). Read-only: writes nothing.
//   npx tsx scripts/inspect-file.ts "<path>"
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

import { readXlsx } from '../src/services/migration/xlsx.domain'
import { inspectUpload } from '../src/services/migration/inspect.domain'
import { suggestMapping, type MigrationEntity } from '../src/services/migration/migration.entities'

const path = process.argv[2]
if (!path) throw new Error('usage: tsx scripts/inspect-file.ts <file>')
const bytes = readFileSync(path)

console.log('== raw workbook')
const workbook = bytes[0] === 0x50 && bytes[1] === 0x4b
for (const sheet of workbook ? readXlsx(bytes) : []) {
  console.log(
    `sheet «${sheet.name}»: ${sheet.rows.length} rows × ${sheet.rows[0]?.length ?? 0} cols`,
  )
  for (const row of sheet.rows.slice(0, 4)) console.log('   ', JSON.stringify(row.slice(0, 12)))
}

console.log('\n== inspection (what the import page sees)')
const result = workbook
  ? inspectUpload({ filename: basename(path), base64: bytes.toString('base64') })
  : inspectUpload({ filename: basename(path), text: bytes.toString('utf8') })
const tables = result.sheets.length > 0 ? result.sheets : [{ name: basename(path), ...result }]
for (const sheet of tables) {
  console.log(
    `sheet «${sheet.name}»: entity=${sheet.detection.entity ?? 'UNKNOWN'} confidence=${sheet.detection.confidence} rows=${sheet.rowCount} skipped=${sheet.skippedRows}`,
  )
  if (sheet.detection.entity) {
    const mapping = suggestMapping(sheet.detection.entity as MigrationEntity, sheet.headers)
    const placed = mapping.filter((m) => m.targetField)
    const dropped = mapping.filter((m) => !m.targetField && m.sourceHeader.trim() !== '')
    console.log(
      `    placed (${placed.length}):`,
      placed.map((m) => `${m.sourceHeader}→${m.targetField}`).join(' | '),
    )
    console.log(
      `    NOT placed (${dropped.length}):`,
      dropped.map((m) => m.sourceHeader).join(' | '),
    )
  }
}
console.log('ignored sheets:', JSON.stringify(result.sheet?.ignored ?? []))
