import { readFileSync, writeFileSync } from 'node:fs'

const root = 'C:/Users/hamed/Desktop/hisabche'
const files = [
  'docs/ai-usage-01-migration.sql',
  'docs/VERIFY-ai-usage-01.sql',
  'backend/src/services/ai/ai-chat.service.ts',
  'backend/src/services/ai/ai-settings.service.ts',
  'backend/src/services/admin/admin-ai.service.ts',
  'backend/src/__tests__/ai-usage-01.pg.test.ts',
]

let changed = 0
for (const rel of files) {
  const path = `${root}/${rel}`
  const before = readFileSync(path, 'utf8')
  const after = before
    .replace(/ai-admin-01/g, 'ai-usage-01')
    .replace(/VERIFY-ai-usage-01\.sql/g, 'VERIFY-ai-usage-01.sql')
    .replace(/hisabche-pg-ai-admin-/g, 'hisabche-pg-ai-usage-')
  if (after !== before) {
    writeFileSync(path, after)
    changed += 1
    console.log(`updated ${rel}`)
  }
}
console.log(`files changed: ${changed}`)
