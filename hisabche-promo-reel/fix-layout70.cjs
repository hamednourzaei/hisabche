const fs = require('fs')
let c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')

// Find the specific entry for id: '70' and change its layoutTopology
// The pattern is specific to the 70 entry at the end
const bad = `  {
    id: '70',
    title: 'ulyssexbt: Genesis Block',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',`

const good = `  {
    id: '70',
    title: 'ulyssexbt: Genesis Block',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'asymmetrical-swiss-grid',`

if (!c.includes(bad)) {
  console.error('Pattern not found!')
  process.exit(1)
}

const newC = c.replace(bad, good)
fs.writeFileSync('src/data/reel-registry.ts', newC, 'utf8')
console.log('DONE - Fixed layout topology for reel 70')
