const fs = require('fs')
const path = require('path')

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const full = path.join(dir, file)
    if (fs.statSync(full).isDirectory()) {
      if (!full.includes('node_modules') && !full.includes('__tests__') && !full.includes('.git')) {
        walk(full, fileList)
      }
    } else if (file.endsWith('.tsx')) {
      fileList.push(full)
    }
  }
  return fileList
}

const persianRegex = /[\u0600-\u06FF]/
const files = walk('packages/ui/src/components/ui')
const rawStrings = []

for (const f of files) {
  if (f.includes('landing/')) continue // skip marketing landing pages
  const content = fs.readFileSync(f, 'utf8')
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
    if (persianRegex.test(trimmed)) {
      // Check if it's NOT inside a t(...) call
      if (!trimmed.includes('t(') && !trimmed.includes('tr(') && !trimmed.includes('safeT(')) {
        rawStrings.push({
          file: f.replace(/\\/g, '/'),
          line: idx + 1,
          text: trimmed,
        })
      }
    }
  })
}

console.log('Total raw Persian strings in UI components:', rawStrings.length)
const byFile = {}
rawStrings.forEach((r) => {
  byFile[r.file] = byFile[r.file] || []
  byFile[r.file].push(r)
})

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n${file} (${items.length} lines):`)
  items.slice(0, 4).forEach((it) => console.log(`  L${it.line}: ${it.text}`))
}
