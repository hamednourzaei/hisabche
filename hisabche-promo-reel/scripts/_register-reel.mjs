// One-shot helper (deleted after use): registers a reel in index / registry / ledger.
// usage: node scripts/_register-reel.mjs <config.json>
import fs from 'node:fs'

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const swap = (file, before, after) => {
  const s = fs.readFileSync(file, 'utf8')
  if (s.includes(after)) return
  if (s.split(before).length !== 2)
    throw new Error(`anchor not unique in ${file}: ${before.slice(0, 60)}`)
  fs.writeFileSync(
    file,
    s.replace(before, () => after),
  )
}

const prev = String(Number(cfg.id) - 1)
const index = 'src/reels/index.ts'
// import line after the previous reel's import
const idx = fs.readFileSync(index, 'utf8')
const prevImport = idx.split('\n').find((l) => l.startsWith(`import { reel${prev} }`))
if (!prevImport) throw new Error('previous reel import not found')
if (!idx.includes(`reel${cfg.id} }`))
  swap(index, prevImport + '\n', `${prevImport}\nimport { reel${cfg.id} } from './${cfg.module}'\n`)
let s = fs.readFileSync(index, 'utf8')
if (!s.includes(`  reel${cfg.id},`)) {
  const parts = s.split(`  reel${prev},\n`)
  if (parts.length !== 3)
    throw new Error(`expected reel${prev} listed twice, got ${parts.length - 1}`)
  fs.writeFileSync(index, parts.join(`  reel${prev},\n  reel${cfg.id},\n`))
}

const ops = cfg.operators.map((o) => `'${o}'`).join(', ')
const entry = `  {
    id: '${cfg.id}',
    title: '${cfg.title}',
    artDirection: '${cfg.artDirection}',
    layoutTopology: '${cfg.layoutTopology}',
    operators: [${ops}],
    themeName: '${cfg.themeName}',
    cardQuotaMax: 0,
    targetCustomer: '${cfg.targetCustomer}',
    openingArchetype: '${cfg.openingArchetype}',
    merchantPainCategory: '${cfg.pain}',
    audioStrategy: '${cfg.audio}',
    viralTemplate: '${cfg.viral}',
    description: '${cfg.description}',
  },
]`
const reg = 'src/data/reel-registry.ts'
const regText = fs.readFileSync(reg, 'utf8')
if (!regText.includes(`id: '${cfg.id}',`)) {
  const marker = '  },\n]\n\n// Ensure every entry in the registry carries'
  if (regText.split(marker).length !== 2) throw new Error('registry end marker')
  fs.writeFileSync(
    reg,
    regText.replace(
      marker,
      () => `  },\n${entry}\n\n// Ensure every entry in the registry carries`,
    ),
  )
}

const ledger = 'src/data/reel-ledger.json'
const ledgerText = fs.readFileSync(ledger, 'utf8')
if (!ledgerText.includes(`"id": "${cfg.id}"`)) {
  const comps = cfg.components.map((c) => `"${c}"`).join(', ')
  const row = `    {
      "id": "${cfg.id}",
      "title": "${cfg.title}",
      "theme": "${cfg.themeName}",
      "hookFormula": "${cfg.openingArchetype}",
      "dominantLayout": "${cfg.layoutTopology}",
      "cardQuotaPercent": 0,
      "components": [${comps}]
    }
  ]
}`
  const tail = ledgerText.replace(/\s*\]\s*\}\s*$/, '')
  fs.writeFileSync(ledger, `${tail},\n${row}\n`)
}
console.log(`reel ${cfg.id} registered`)
