import fs from 'node:fs'

const owners = fs.readFileSync('docs/sales/hisabche-features-for-owners.md', 'utf8')
const script = fs.readFileSync('docs/sales/hisabche-sales-script.md', 'utf8')
const evidence = fs.readFileSync('docs/sales/_evidence.md', 'utf8')
const claims = fs.readFileSync('docs/sales/_claims-check.md', 'utf8')

// owner statuses: "### [F-01] name" ... "- **وضعیت:** AVAILABLE"
const ownerStatus = {}
const ownerName = {}
const blocks = owners.split(/\n(?=### \[F-)/)
for (const b of blocks) {
  const m = b.match(/^### \[(F-\d+)\]\s*(.+)$/m)
  if (!m) continue
  const st = b.match(/\*\*وضعیت:\*\*\s*([A-Z]+)/)
  ownerStatus[m[1]] = st ? st[1] : 'UNKNOWN'
  ownerName[m[1]] = m[2].trim()
}
// evidence statuses
const evStatus = {}
for (const line of evidence.split(/\r?\n/)) {
  const m = line.match(/^\|\s*\*\*(F-\d+)\*\*\s*\|[^|]*\|\s*([A-Z]+)\s*\|/)
  if (m) evStatus[m[1]] = m[2]
}

const ids = Object.keys(ownerStatus).sort()
console.log(`owner features=${ids.length} evidence=${Object.keys(evStatus).length}`)

let fail = 0
for (const id of ids) {
  if (ownerStatus[id] !== evStatus[id]) {
    fail++
    console.log(
      `STATUS MISMATCH ${id}: owner=${ownerStatus[id]} evidence=${evStatus[id] ?? 'MISSING'}`,
    )
  }
}

// IDs cited in script
const cited = [...new Set([...script.matchAll(/F-\d+/g)].map((m) => m[0]))].sort()
console.log(`script cites ${cited.length} ids: ${cited.join(',')}`)
for (const id of cited) {
  if (!ownerStatus[id]) {
    fail++
    console.log(`SCRIPT CITES UNKNOWN ID ${id}`)
  } else if (ownerStatus[id] === 'PLANNED' || ownerStatus[id] === 'UNCLEAR') {
    fail++
    console.log(`SCRIPT CITES NON-DELIVERABLE ${id} (${ownerStatus[id]})`)
  }
}

// claims-check ids must all be known
for (const id of [...new Set([...claims.matchAll(/F-\d+/g)].map((m) => m[0]))]) {
  if (!ownerStatus[id]) {
    fail++
    console.log(`CLAIMS-CHECK UNKNOWN ID ${id}`)
  }
}
console.log(fail === 0 ? 'PASS: consistency' : `FAIL: ${fail}`)
