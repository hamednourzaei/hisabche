// Extracts the committed stock panel to the approved temp dir for comparison.
const { execSync } = require('node:child_process')
const { writeFileSync } = require('node:fs')

const out = execSync(
  'git show HEAD:packages/ui/src/components/ui/warehouse-detail/product-warehouse-stock-panel.tsx',
  { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
)
writeFileSync('C:/Users/hamed/AppData/Local/Temp/opencode/orig-stock-panel.txt', out)
console.log('bytes:', out.length)
