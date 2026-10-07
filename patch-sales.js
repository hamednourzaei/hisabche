const fs = require('fs')
const file = 'packages/ui/src/components/ui/invoices/containers/sales-hub-container.tsx'
let code = fs.readFileSync(file, 'utf8')

code = code.replace(
  "import { HubTabs, useHubTab } from '../../hub-tabs'",
  "import { HubTabs, useHubTab } from '../../hub-tabs'\nimport { usePageLook } from '../../../../lib/page-look'\nimport { RegisterCustomizer } from '../../register-customizer'\nimport { hubLookId } from '../../page-hub'"
)

code = code.replace(
  'const [active, select] = useHubTab(offered)',
  "const look = usePageLook('hub:invoices')\n  const [active, select] = useHubTab(offered)"
)

code = code.replace(
  '<div className="space-y-4">',
  `<div className="relative space-y-4">
      <RegisterCustomizer
        groups={[
          {
            title: t('pageLook.hubSections', 'بخش‌های این صفحه'),
            look,
            keepOne: true,
            items: SALES_HUB_TABS.map(tab => ({
              id: hubLookId(tab, tab),
              label: t(\`salesHub.tabs.\${tab}\`, tab)
            }))
          }
        ]}
      />`
)

fs.writeFileSync(file, code)
