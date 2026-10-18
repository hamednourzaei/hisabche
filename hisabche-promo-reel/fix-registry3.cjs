const fs = require('fs')
let c = fs.readFileSync('src/data/reel-registry.ts', 'utf8')

// Fix: Add comma after entry 69's closing brace (before entry 70)
const bad = `    description:
      'کاراکتر دیترشده‌ی حسابچه نشان می‌دهد یک فاکتور چه می‌کند: کالا و خدمت و جنس وزنی در یک سند، نیمی نقد و نیمی نسیه، نرخ دالر همان روز روی فاکتور، و در اوج پنج کار هم‌زمان — انبار، صندوق، دفتر کل، طلب مشتری و سود',
  }
  {
    id: '70'`

const good = `    description:
      'کاراکتر دیترشده‌ی حسابچه نشان می‌دهد یک فاکتور چه می‌کند: کالا و خدمت و جنس وزنی در یک سند، نیمی نقد و نیمی نسیه، نرخ دالر همان روز روی فاکتور، و در اوج پنج کار هم‌زمان — انبار، صندوق، دفتر کل، طلب مشتری و سود',
  },
  {
    id: '70'`

if (!c.includes(bad)) {
  console.error('Pattern not found!')
  process.exit(1)
}

const newC = c.replace(bad, good)
fs.writeFileSync('src/data/reel-registry.ts', newC, 'utf8')
console.log('DONE - Fixed registry (added comma between 69 and 70)')
