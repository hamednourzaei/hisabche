import fs from 'node:fs'

const content = fs.readFileSync(
  'packages/validation/src/schemas/offline-endpoint-matrix.ts',
  'utf8',
)

// match lines like: 'METHOD /path': ['feature', 'status'],
const rowRegex =
  /^\s*['"]([A-Z]+\s+[^'"]+)['"]\s*:\s*\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/gm

let match
let available = 0
let online_required = 0
let not_supported = 0
let total = 0

while ((match = rowRegex.exec(content)) !== null) {
  const [, endpoint, , status] = match
  total++
  if (status === 'available') available++
  else if (status === 'online_required') online_required++
  else if (status === 'not_supported') not_supported++
  else console.warn('Unknown status:', status, endpoint)
}

console.log(JSON.stringify({ total, available, online_required, not_supported }, null, 2))
