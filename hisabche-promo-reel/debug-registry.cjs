const fs = require('fs')
const c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')

// Find the position of id: '69'
const idx69 = c.indexOf("id: '69'")
console.log('Found 69 at:', idx69)

// Find the position of id: '70'
const idx70 = c.indexOf("id: '70'")
console.log('Found 70 at:', idx70)

// Show the content between them
if (idx69 >= 0 && idx70 > idx69) {
  const between = c.substring(idx69, idx70 + 200)
  console.log('BETWEEN:')
  console.log(JSON.stringify(between))
}
