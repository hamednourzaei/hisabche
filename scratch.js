const fs = require('fs')
let code = fs.readFileSync(
  'packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx',
  'utf8',
)

code = code.replace(
  "const menuLook = usePageLook('menu')",
  "// const menuLook = usePageLook('menu')",
)
code = code.replace(
  "import { NAV_ITEMS } from '../../../../lib/menu/nav-items'",
  "// import { NAV_ITEMS } from '../../../../lib/menu/nav-items'",
)

fs.writeFileSync('packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx', code)
