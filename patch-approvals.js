const fs = require('fs')
const file = 'packages/ui/src/components/ui/workflow/containers/approvals-hub-container.tsx'
let code = fs.readFileSync(file, 'utf8')

code = code.replace(
  "import { HubTabs, useHubTab } from '../../hub-tabs'",
  "import { HubTabs, useHubTab } from '../../hub-tabs'\nimport { usePageLook } from '../../../../lib/page-look'\nimport { RegisterCustomizer } from '../../register-customizer'\nimport { hubLookId } from '../../page-hub'"
)

code = code.replace(
  'const [active, select] = useHubTab(APPROVALS_HUB_TABS)',
  "const look = usePageLook('hub:approvals')\n  const [active, select] = useHubTab(APPROVALS_HUB_TABS)"
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
            items: APPROVALS_HUB_TABS.map(tab => ({
              id: hubLookId(tab, tab),
              label: t(\`approvalsHub.tabs.\${tab}\`, tab)
            }))
          }
        ]}
      />`
)

fs.writeFileSync(file, code)
