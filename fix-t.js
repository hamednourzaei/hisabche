const fs = require('fs')
const files = [
  'apps/admin/components/cms/cms-media-client.tsx',
  'apps/admin/components/cms/cms-page-editor-client.tsx',
  'apps/admin/components/cms/cms-pages-client.tsx',
]
files.forEach((f) => {
  let content = fs.readFileSync(f, 'utf8')
  content = content.replace(/t\('([^']+)',\s*'([^']+)'\)/g, "t('$1')")
  fs.writeFileSync(f, content)
})
console.log('Fixed t() calls')
