const fs = require('fs')
let c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')

// Find the position right before the closing ] of REEL_REGISTRY_LIST
const listEndIdx = c.indexOf(
  '// Ensure every entry in the registry carries its designated viral template',
)
if (listEndIdx === -1) {
  console.error('Could not find marker')
  process.exit(1)
}

// Find the last '  },' before that position
const beforeListEnd = c.substring(0, listEndIdx)
const lastEntryEnd = beforeListEnd.lastIndexOf('  },')
if (lastEntryEnd === -1) {
  console.error('Could not find last entry')
  process.exit(1)
}

// Insert after the last '  },'
const insertPos = lastEntryEnd + 3 // after '  },'
const entry = `\n  {
    id: '70',
    title: 'ulyssexbt: Genesis Block',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'GenesisFreeze',
      'BlockStackOdometer',
      'NetworkPulseConstellation',
      'FinalLockCta',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 2,
    targetCustomer: 'wholesaler',
    openingArchetype: 'visual-pattern-interrupt',
    audioStrategy: 'rhythmic-urgency',
    description:
      'هویت بصری ulyssexbt در ۱۵ ثانیه: ژنسیس فریز، پشته بلاک با هش و ارتفاع، شبکه ۱۲۸ نود با صفر تاخیر، و قفل نهایی برند — هویتی که برای X طراحی شده است',
  },`

const newC = c.slice(0, insertPos) + entry + c.slice(insertPos)
fs.writeFileSync('src/data/reel-registry.ts', newC, 'utf8')
console.log('DONE')
