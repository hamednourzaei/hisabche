const fs = require('fs')
let code = fs.readFileSync('packages/ui/src/components/ui/dashboard-header.tsx', 'utf8')

if (!code.includes('import { GlobalPageCustomizer }')) {
  code = code.replace(
    "import { useTranslations } from 'next-intl'",
    "import { useTranslations } from 'next-intl'\nimport { GlobalPageCustomizer } from './global-page-customizer'",
  )
}
code = code.replace('<div id="global-page-customizer-slot"></div>', '<GlobalPageCustomizer />')

fs.writeFileSync('packages/ui/src/components/ui/dashboard-header.tsx', code)
