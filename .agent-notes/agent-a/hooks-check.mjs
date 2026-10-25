import fs from 'node:fs'
import path from 'node:path'

const terms = [
  'useShelves',
  'useStorefront',
  'useCustomerPortal',
  'useAttendanceLink',
  'useConflicts',
  'usePeerBenchmark',
  'useAssets',
  'useBudgets',
  'useRecurring',
  'useReportBuilder',
  'useWarehouseMap',
  'useBankStatements',
  'useManufacturing',
  'useInstallmentPlan',
  'usePayroll',
  'useEmployees',
  'useLateFee',
  'useExpiry',
  'useTransfers',
  'useStockCount',
]
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name)) files.push(p)
  }
}
walk('packages/api/src/hooks')
walk('packages/ui/src/components/ui')

const out = []
for (const t of terms) {
  const hits = files.filter((f) => fs.readFileSync(f, 'utf8').includes(t))
  out.push(`${t}: ${hits.length ? hits.slice(0, 3).join(' | ') : 'NONE'}`)
}
fs.writeFileSync('.agent-notes/agent-a/_hooks-check.txt', out.join('\n'), 'utf8')
console.log(out.join('\n'))
