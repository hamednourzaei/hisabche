const fs = require('fs')
let c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')

// Find the operators array for reel 70 and add a 5th operator
const bad = `    operators: [
      'GenesisFreeze',
      'BlockStackOdometer',
      'NetworkPulseConstellation',
      'FinalLockCta',
    ],`

const good = `    operators: [
      'GenesisFreeze',
      'BlockStackOdometer',
      'NetworkPulseConstellation',
      'FinalLockCta',
      'BrandLockReveal',
    ],`

if (!c.includes(bad)) {
  console.error('Pattern not found!')
  process.exit(1)
}

const newC = c.replace(bad, good)
fs.writeFileSync('src/data/reel-registry.ts', newC, 'utf8')
console.log('DONE - Added 5th operator to reel 70')
