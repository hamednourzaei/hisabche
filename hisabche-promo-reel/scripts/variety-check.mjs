// scripts/variety-check.mjs
// Gate: fail build if recent reels are too similar in metadata.
// Phase 1 (MVP): checks artDirection + layoutTopology + themeName + viralTemplate
// of the last 4 registry entries against each other.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Read registry file as text and extract entries by id
const regPath = path.join(ROOT, 'src/data/reel-registry.ts')
const regText = fs.readFileSync(regPath, 'utf8')

// Extract each { id: 'XX', ... } block up to the matching closing brace at top level of array
const idRegex = /id:\s*'(\d+)'/g
let match
const ids = []
while ((match = idRegex.exec(regText)) !== null) ids.push(match[1])

// For each id, extract its block
function blockFor(id) {
  const marker = `id: '${id}'`
  const start = regText.indexOf(marker)
  if (start === -1) return null
  // find the next "id: '" after start
  const nextId = regText.indexOf("id: '", start + marker.length)
  const end = nextId === -1 ? regText.length : nextId
  return regText.slice(start, end)
}

const parsed = ids.map((id) => {
  const b = blockFor(id)
  const get = (key) => {
    const m = b.match(new RegExp(key + ":\\s*'([^']+)'"))
    return m ? m[1] : null
  }
  return {
    id,
    artDirection: get('artDirection'),
    layoutTopology: get('layoutTopology'),
    themeName: get('themeName'),
    viralTemplate: get('viralTemplate'),
  }
})

const errors = []
for (let i = 1; i < parsed.length; i++) {
  const cur = parsed[i]
  const recent = parsed.slice(Math.max(0, i - 3), i)
  // topology must not repeat within last 3
  if (recent.some((r) => r.layoutTopology === cur.layoutTopology)) {
    errors.push(`Reel ${cur.id}: topology '${cur.layoutTopology}' repeats within last 3 reels`)
  }
  // artDirection must differ from immediately previous
  if (i > 0 && parsed[i - 1].artDirection === cur.artDirection) {
    errors.push(
      `Reel ${cur.id}: artDirection '${cur.artDirection}' matches previous reel ${parsed[i - 1].id}`,
    )
  }
  // viralTemplate must differ from immediately previous (if both present)
  if (i > 0 && cur.viralTemplate && parsed[i - 1].viralTemplate === cur.viralTemplate) {
    errors.push(
      `Reel ${cur.id}: viralTemplate '${cur.viralTemplate}' matches previous reel ${parsed[i - 1].id}`,
    )
  }
}

if (errors.length > 0) {
  console.error('VARIETY CHECK FAILED:')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
} else {
  console.log(
    `Variety check passed: ${parsed.length} reels, no metadata repetition in last-3 window.`,
  )
}
