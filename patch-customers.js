const fs = require('fs')
const file = 'packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx'
let code = fs.readFileSync(file, 'utf8')

code = code.replace(
  "import { isNavLocked } from '@hisabche/ui-contract'",
  "import { isNavLocked } from '@hisabche/ui-contract'\nimport { usePageLook } from '../../../../lib/page-look'\nimport { RegisterCustomizer } from '../../register-customizer'\nimport { hubLookId } from '../../page-hub'"
)

const target = `  const sections = OUTREACH_SECTIONS.filter(
    (section) => !isNavLocked(OUTREACH_SOURCE[section], blocked),
  )
  // A tab with nothing this person may open is not a tab.
  const offered = CUSTOMERS_HUB_TABS.filter((tab) => tab !== 'outreach' || sections.length > 0)
  const [active, select] = useHubTab(offered)
  const [section, selectSection] = useHubSection(sections)

  return (
    <div className="space-y-4">`

const replacement = `  const allowedSections = OUTREACH_SECTIONS.filter(
    (section) => !isNavLocked(OUTREACH_SOURCE[section], blocked),
  )
  const allowedTabs = CUSTOMERS_HUB_TABS.filter((tab) => tab !== 'outreach' || allowedSections.length > 0)
  
  const look = usePageLook('hub:customers')
  
  const sections = allowedSections.filter(sec => look.shows(hubLookId('outreach', sec)))
  const offered = allowedTabs.filter(tab => tab === 'customers' ? look.shows(hubLookId('customers', 'customers')) : sections.length > 0)
  
  const [active, select] = useHubTab(offered)
  const [section, selectSection] = useHubSection(sections)

  return (
    <div className="relative space-y-4">
      <RegisterCustomizer
        groups={[
          {
            title: t('pageLook.hubSections', 'بخش‌های این صفحه'),
            look,
            keepOne: true,
            items: [
              ...(allowedTabs.includes('customers') ? [{ id: hubLookId('customers', 'customers'), label: t('customersHub.tabs.customers') }] : []),
              ...allowedSections.map(sec => ({ id: hubLookId('outreach', sec), label: t(\`customersHub.sections.\${sec}\`) }))
            ]
          }
        ]}
      />`

code = code.replace(target, replacement)
fs.writeFileSync(file, code)
