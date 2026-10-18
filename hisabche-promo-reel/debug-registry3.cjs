const fs = require('fs')
const c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')
const idx70 = c.indexOf("id: '70'")
if (idx70 >= 0) {
  const after = c.substring(idx70 + 500, idx70 + 800)
  console.log('AFTER 70 (later):')
  console.log(JSON.stringify(after))
}
