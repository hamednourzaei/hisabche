const fs = require('fs')
const c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')
const idx70 = c.indexOf("id: '70'")
if (idx70 >= 0) {
  const after = c.substring(idx70 + 300, idx70 + 500)
  console.log('AFTER 70:')
  console.log(JSON.stringify(after))
}
