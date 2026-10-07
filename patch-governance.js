const fs = require('fs')
const file = 'packages/ui/src/components/ui/governance/containers/governance-hub-container.tsx'
let code = fs.readFileSync(file, 'utf8')

code = code.replace(
  "import { HubTabs } from '../../hub-tabs'",
  "import { HubTabs } from '../../hub-tabs'\nimport { usePageLook } from '../../../../lib/page-look'\nimport { RegisterCustomizer } from '../../register-customizer'\nimport { hubLookId } from '../../page-hub'"
)

code = code.replace(
  '<CapabilityPage>',
  "const look = usePageLook('hub:governance')\n\n  return (\n    <CapabilityPage>"
)

code = code.replace(
  '<div className="space-y-3">',
  `<div className="relative space-y-3">
        <RegisterCustomizer
          groups={[
            {
              title: t('pageLook.hubSections', 'O"OrO'?OUO OUU+ O1U?O-U'),
              look,
              keepOne: true,
              items: TABS.map(tab => ({
                id: hubLookId(governanceGroupOf(tab), tab),
                label: t(\`governance.tab_\${tab}\`, tab)
              }))
            }
          ]}
        />`
)

fs.writeFileSync(file, code)
