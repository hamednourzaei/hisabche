const fs = require('fs')
const files = [
  'packages/ui/src/components/ui/page-hub.tsx',
  'packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx',
  'packages/ui/src/components/ui/invoices/containers/sales-hub-container.tsx',
  'packages/ui/src/components/ui/warehouse/containers/warehouse-tabs-container.tsx',
  'packages/ui/src/components/ui/workflow/containers/approvals-hub-container.tsx',
  'packages/ui/src/components/ui/governance/containers/governance-hub-container.tsx'
]

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8')
  code = code.replace(/title:\s*t\('pageLook\.hubSections'[^)]+\)/g, "title: t('pageLook.hubSections' as any)")
  code = code.replace(/label:\s*t\([^,]+,\s*tab\)/g, (match) => match.replace(', tab)', ' as any)'))
  code = code.replace(/label:\s*t\([^,]+,\s*sec\)/g, (match) => match.replace(', sec)', ' as any)'))
  fs.writeFileSync(file, code)
}
