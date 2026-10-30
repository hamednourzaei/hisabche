import fs from 'node:fs'

const content = fs.readFileSync('packages/ui/src/components/ui/settings/settings-page.tsx', 'utf8')
const lines = content.split('\n')

lines.forEach((line, i) => {
  if (line.includes("t('") && line.includes("', '")) {
    console.log(`Line ${i + 1}: ${line.trim()}`)
  }
})
