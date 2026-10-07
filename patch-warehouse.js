const fs = require('fs')
const file = 'packages/ui/src/components/ui/warehouse/containers/warehouse-tabs-container.tsx'
let code = fs.readFileSync(file, 'utf8')

code = code.replace(
  "import { HubTabs, useHubSection, useHubTab } from '../../hub-tabs'",
  "import { HubTabs, useHubSection, useHubTab } from '../../hub-tabs'\nimport { usePageLook } from '../../../../lib/page-look'\nimport { RegisterCustomizer } from '../../register-customizer'\nimport { hubLookId } from '../../page-hub'"
)

const target = `function WarehouseHub() {
  const t = useTranslations()
  const blocked = useMyCapabilities().data?.blockedModules ?? []
  const offered = WAREHOUSE_HUB_TABS.filter(
    (tab) => !isNavLocked(WAREHOUSE_HUB_SOURCE[tab], blocked),
  )
  const [active, select] = useHubTab(offered)
  const [section, selectSection] = useHubSection(STOCK_SECTIONS, STOCK_SECTION_CLEARS)

  // The catalogue's old address, \`?tab=products\`, is a section now.
  const params = useSearchParams()
  const localeReplace = useLocaleReplace()
  const oldCatalogueAddress = params.get('tab') === 'products'
  useEffect(() => {
    if (oldCatalogueAddress) localeReplace('/warehouse?view=products')
  }, [oldCatalogueAddress, localeReplace])

  return (
    <div className="space-y-4">`

const replacement = `function WarehouseHub() {
  const t = useTranslations()
  const blocked = useMyCapabilities().data?.blockedModules ?? []
  
  const allowedTabs = WAREHOUSE_HUB_TABS.filter(
    (tab) => !isNavLocked(WAREHOUSE_HUB_SOURCE[tab], blocked),
  )
  const look = usePageLook('hub:warehouse')

  const offeredStockSections = STOCK_SECTIONS.filter(sec => look.shows(hubLookId('stock', sec)))
  const offered = allowedTabs.filter(tab => {
    if (tab === 'expiry') return look.shows(hubLookId('expiry', 'expiry'))
    return offeredStockSections.length > 0
  })

  const [active, select] = useHubTab(offered)
  const [section, selectSection] = useHubSection(offeredStockSections, STOCK_SECTION_CLEARS)

  // The catalogue's old address, \`?tab=products\`, is a section now.
  const params = useSearchParams()
  const localeReplace = useLocaleReplace()
  const oldCatalogueAddress = params.get('tab') === 'products'
  useEffect(() => {
    if (oldCatalogueAddress) localeReplace('/warehouse?view=products')
  }, [oldCatalogueAddress, localeReplace])

  return (
    <div className="relative space-y-4">
      <RegisterCustomizer
        groups={[
          {
            title: t('pageLook.hubSections', 'بخش‌های این صفحه'),
            look,
            keepOne: true,
            items: [
              ...(allowedTabs.includes('expiry') ? [{ id: hubLookId('expiry', 'expiry'), label: t('warehouseHub.tabs.expiry') }] : []),
              ...(allowedTabs.includes('stock') ? STOCK_SECTIONS.map(sec => ({ id: hubLookId('stock', sec), label: t(\`warehouseHub.sections.\${sec}\`) })) : [])
            ]
          }
        ]}
      />`

code = code.replace(target, replacement)
fs.writeFileSync(file, code)
