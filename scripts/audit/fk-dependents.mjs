// Read-only: for the nine sync entities' tables, which tables reference them (FOREIGN KEY ... REFERENCES t), with the
// ON DELETE rule and whether the constraint is NOT VALID, and which triggers on those tables could stop a DELETE.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TARGETS = [
  'invoices',
  'customers',
  'products',
  'transactions',
  'time_entries',
  'warehouses',
  'branches',
  'exchange_rates',
  'warehouse_stock',
]
const files = fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.sql'))
const out = Object.fromEntries(TARGETS.map((t) => [t, []]))
const delTriggers = Object.fromEntries(TARGETS.map((t) => [t, []]))
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, 'docs', f), 'utf8')
  // ALTER TABLE x ... FOREIGN KEY ... REFERENCES y (...) [ON DELETE ...] [NOT VALID]
  for (const m of s.matchAll(
    /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?"?(\w+)"?[\s\S]{0,400}?FOREIGN\s+KEY\s*\([^)]*\)\s*REFERENCES\s+(?:public\.)?"?(\w+)"?\s*\([^)]*\)([^;]*);/gi,
  )) {
    const [, owner, target, tail] = m
    if (TARGETS.includes(target))
      out[target].push({
        owner,
        file: f,
        onDelete: (tail.match(/ON\s+DELETE\s+(CASCADE|SET NULL|RESTRICT|NO ACTION)/i) || [
          '',
          'NO ACTION (default)',
        ])[1].toUpperCase(),
        notValid: /NOT\s+VALID/i.test(tail),
      })
  }
  // inline: CREATE TABLE owner ( ... col uuid REFERENCES target (id) [ON DELETE ...] )
  for (const m of s.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/gi,
  )) {
    const owner = m[1]
    for (const r of m[2].matchAll(/REFERENCES\s+(?:public\.)?"?(\w+)"?\s*\([^)]*\)([^,\n]*)/gi)) {
      if (TARGETS.includes(r[1]))
        out[r[1]].push({
          owner,
          file: f,
          onDelete: (r[2].match(/ON\s+DELETE\s+(CASCADE|SET NULL|RESTRICT|NO ACTION)/i) || [
            '',
            'NO ACTION (default)',
          ])[1].toUpperCase(),
          notValid: false,
        })
    }
  }
  // triggers that fire BEFORE DELETE (or UPDATE OR DELETE) on the targets
  for (const m of s.matchAll(
    /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(\w+)[\s\S]{0,200}?(BEFORE|AFTER)\s+([A-Z ]*DELETE[A-Z ]*)\s+ON\s+(?:public\.)?"?(\w+)"?/gi,
  )) {
    if (TARGETS.includes(m[4]))
      delTriggers[m[4]].push({ name: m[1], timing: m[2], event: m[3].trim(), file: f })
  }
}
const uniq = (a) => [...new Map(a.map((x) => [JSON.stringify(x), x])).values()]
const res = {}
for (const t of TARGETS)
  res[t] = { referencedBy: uniq(out[t]), deleteTriggers: uniq(delTriggers[t]) }
fs.writeFileSync(
  path.join(ROOT, 'docs/audit/generated/fk-dependents.json'),
  JSON.stringify(res, null, 1),
)
for (const t of TARGETS) {
  console.log('==', t)
  for (const d of res[t].referencedBy)
    console.log(
      '   referenced by',
      d.owner,
      '| on delete',
      d.onDelete,
      d.notValid ? '| NOT VALID' : '',
      '|',
      d.file,
    )
  for (const d of res[t].deleteTriggers)
    console.log('   DELETE TRIGGER', d.name, d.timing, d.event, '|', d.file)
  if (!res[t].referencedBy.length && !res[t].deleteTriggers.length)
    console.log('   (no FK dependents and no delete trigger found)')
}
