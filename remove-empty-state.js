const fs = require('fs')
const file = 'packages/ui/src/components/ui/dashboard/sales-chart.tsx'
let code = fs.readFileSync(file, 'utf8')

const targetRegex = /\s*\/\/\s*Empty state with motivation\s*if\s*\(!hasData\s*\|\|\s*allZero\)\s*\{\s*return\s*\([\s\S]*?<\/[sS]ection>\s*\)\s*\}/

code = code.replace(targetRegex, '')
fs.writeFileSync(file, code)
