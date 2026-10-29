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
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(full)
    }
  }
  return fileList
}

const persianRegex = /[\u0600-\u06FF]/
const files = walk('packages/ui/src')
const findings = []

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8')
  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
    if (persianRegex.test(trimmed)) {
      // Check if it is a fallback argument in t('key', 'فارسی')
      const isFallback = /t\([^)]+,\s*['"][^'"]*[\u0600-\u06FF]/.test(trimmed)
      if (!isFallback) {
        findings.push({ file: f.replace(/\\/g, '/'), line: idx + 1, text: trimmed })
      }
    }
  })
}

console.log('Total findings:', findings.length)
// Group by file
const byFile = {}
for (const item of findings) {
  byFile[item.file] = (byFile[item.file] || 0) + 1
}

console.log('Top files with hardcoded Persian strings:')
const sorted = Object.entries(byFile).sort((a, b) => b[1] - a[1])
console.log(sorted.slice(0, 25))

fs.writeFileSync('docs/qa/non-i18n-findings.json', JSON.stringify(findings, null, 2))
console.log('Saved to docs/qa/non-i18n-findings.json')
