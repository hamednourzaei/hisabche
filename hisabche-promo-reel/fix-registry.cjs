const fs = require('fs')
let c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')

// Fix 1: Add comma after entry 69's closing brace (before entry 70)
c = c.replace(
  /(audioStrategy: 'rhythmic-urgency',\s+description:[\s\S]*?\?\?\?',\s*}\s*)\n {2}\{\s*id: '70'/,
  "$1,\n  {\n    id: '70'",
)

// Fix 2: Remove extra comma after entry 70's closing brace (`,,]` -> `},]`)
c = c.replace(/ {2}},\s*,\s*\]/, '  }\n]')

fs.writeFileSync('src/data/reel-registry.ts', c, 'utf8')
console.log('DONE')
