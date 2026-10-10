// recon-landing.mjs — inventory every landing violation before touching code.
// Run: node recon-landing.mjs > docs/landing/recon.txt
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'packages/ui/src/components/ui/landing'

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p)
  }
  return out
}

const files = walk(ROOT)
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')

const HEX = /#[0-9a-fA-F]{3,8}\b/
const PALETTE =
  /\b(text|bg|border|from|to|via|ring|fill|stroke)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/
const INTERACTIVE =
  /\b(useState|useEffect|useRef|useMemo|useCallback|useReducer|onClick|onChange|onSubmit|onFocus|onBlur|onKeyDown)\b/
const i18n = /\b(getTranslations|useTranslations)\b/

const report = []
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  const src = strip(raw)
  const rel = f.replace(/\\/g, '/')
  const client = /^\s*['"]use client['"]/.test(raw)
  const rows = {
    file: rel,
    lines: raw.split('\n').length,
    client,
    hex: (src.match(new RegExp(HEX, 'g')) || []).length,
    palette: (src.match(new RegExp(PALETTE, 'g')) || []).length,
    interactive: (src.match(new RegExp(INTERACTIVE, 'g')) || []).length,
    i18n: (src.match(new RegExp(i18n, 'g')) || []).length,
    motionReduce: (src.match(/motion-reduce|prefers-reduced-motion/g) || []).length,
    persian: (src.match(/[؀-ۿ]/g) || []).length,
  }
  report.push(rows)
}

const sum = (k) => report.reduce((a, r) => a + (r[k] ? 1 : 0), 0)
console.log('FILES', report.length)
console.log('use client files      :', report.filter((r) => r.client).length)
console.log(
  'client WITHOUT interactivity (pure markup):',
  report.filter((r) => r.client && r.interactive === 0).length,
)
console.log(
  'files with hex        :',
  sum('hex'),
  ' occurrences:',
  report.reduce((a, r) => a + r.hex, 0),
)
console.log(
  'files with palette    :',
  sum('palette'),
  ' occurrences:',
  report.reduce((a, r) => a + r.palette, 0),
)
console.log('files with i18n       :', sum('i18n'))
console.log('files with motionReduce:', sum('motionReduce'))
console.log(
  'total lines           :',
  report.reduce((a, r) => a + r.lines, 0),
)
console.log(
  'total persian chars   :',
  report.reduce((a, r) => a + r.persian, 0),
)
console.log('')
console.log('--- PER FILE (client && no interactivity) ---')
for (const r of report.filter((x) => x.client && x.interactive === 0)) console.log(r.file, r.lines)
console.log('')
console.log('--- PER FILE (hex/palette > 0) ---')
for (const r of report.filter((x) => x.hex + x.palette > 0))
  console.log(r.file, 'hex=' + r.hex, 'palette=' + r.palette)
