const fs = require('fs')

const data = JSON.parse(fs.readFileSync('docs/qa/non-i18n-findings.json', 'utf8'))

// Filter out landing and marketing scenes
const appFindings = data.filter((d) => !d.file.includes('landing/'))

const byFile = {}
for (const item of appFindings) {
  if (!byFile[item.file]) byFile[item.file] = []
  byFile[item.file].push(item)
}

const sortedFiles = Object.keys(byFile).sort((a, b) => byFile[b].length - byFile[a].length)

console.log('Top App Files with non-i18n strings:')
for (const file of sortedFiles.slice(0, 15)) {
  console.log(`\n=== ${file} (${byFile[file].length} lines) ===`)
  for (const item of byFile[file].slice(0, 5)) {
    console.log(`  Line ${item.line}: ${item.text}`)
  }
}
