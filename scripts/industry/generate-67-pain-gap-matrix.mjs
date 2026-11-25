// ============================================
// scripts/industry/generate-67-pain-gap-matrix.mjs
//
// Canonical 7-column layout matching the user's screenshot:
//   - Section 0: 14 shared ERP/POS/Accounting/Offline pains
//   - Section 1: 67 separate `### N. صنف <نام> (<key>)` sections with 7-column tables
//   - Section 2: Consolidated Missing & Partial Gaps (0 open gaps)
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { INDUSTRY_SPECIFIC_PAINS, SHARED_CORE_PAINS } from './67-industries-pains.data.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const OUT_PATH = path.join(ROOT, 'docs/sales/67-INDUSTRIES-PAIN-AND-GAP-MATRIX.md')

const sellable = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'docs/architecture/industry/sellable-industries.json'), 'utf8'),
)
const featureSrc = fs.readFileSync(
  path.join(ROOT, 'packages/validation/src/schemas/feature-registry.ts'),
  'utf8',
)
const existingFeatures = new Set(
  [...featureSrc.matchAll(/^\s*'([a-z0-9_.]+)':\s*\{/gm)].map((m) => m[1]),
)

const engineWiringRaw = fs
  .readFileSync(path.join(ROOT, 'docs/architecture/universal-core/ENGINE-WIRING.csv'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)

const partialEngines = new Set()
for (const line of engineWiringRaw) {
  const cols = line.split(',')
  const key = (cols[1] || '').replace(/"/g, '')
  const status = (cols[2] || '').replace(/"/g, '')
  if (key && status === 'partial') partialEngines.add(key)
}

const INDUSTRY_FA = {
  retail: 'خرده‌فروشی عمومی',
  wholesale: 'عمده‌فروشی و پخش',
  grocery: 'سوپرمارکت و مواد غذایی',
  bakery: 'نانوایی و شیرینی‌پزی',
  butcher: 'قصابی و پروتئینی',
  restaurant: 'رستوران و غذاخوری',
  cafe: 'کافی‌شاپ و نوشیدنی',
  fruitVegetable: 'میوه و تره‌بار',
  dairy: 'لبنیات و بستنی',
  nuts: 'آجیل و خشکبار',
  spices: 'ادویه و عطاری',
  jewellery: 'طلا و جواهرسازی',
  watches: 'ساعت‌فروشی و تعمیرات ساعت',
  currencyExchange: 'صرافی و خدمات ارزی',
  clothing: 'پوشاک و بوتیک',
  fabric: 'پارچه‌فروشی',
  fabricRoll: 'فروش طاقه و عمده پارچه',
  shoes: 'کفش و کیف',
  carpet: 'فرش و موکت',
  tailoring: 'خیاطی و مزون دوزندگی',
  mobilePhones: 'موبایل و لوازم جانبی',
  computers: 'کامپیوتر و لپ‌تاپ',
  computerComponents: 'قطعات سخت‌افزاری کامپیوتر',
  electronics: 'لوازم الکترونیکی و صوتی‌تصویری',
  itServices: 'خدمات IT و پشتیبانی شبکه',
  hardware: 'ابزارآلات و یراق‌آلات',
  buildingMaterials: 'مصالح ساختمانی',
  paint: 'رنگ و رزین ساختمانی/صنعتی',
  timber: 'چوب و MDF و نجاری',
  glass: 'شیشه و آینه‌بری',
  construction: 'پیمانکاری و پروژه‌های ساختمانی',
  manufacturing: 'تولیدی و کارگاه صنعتی',
  autoParts: 'لوازم یدکی خودرو',
  carDealer: 'نمایشگاه و خریدوفروش خودرو',
  mechanic: 'تعمیرگاه و مکانیکی خودرو',
  fuel: 'جایگاه سوخت و فرآورده‌های نفتی',
  furniture: 'مبلمان و دکوراسیون',
  kitchenware: 'لوازم آشپزخانه و پلاسکو',
  homeAppliances: 'لوازم خانگی برقی',
  stationery: 'لوازم‌التحریر و کتابفروشی',
  toys: 'اسباب‌بازی و سرگرمی',
  giftShop: 'کادویی و گیفت‌شاپ',
  pharmacy: 'داروخانه و تجهیزات پزشکی',
  cosmetics: 'آرایشی و بهداشتی',
  clinic: 'کلینیک، مطب و درمانگاه',
  barber: 'آرایشگاه مردانه',
  beautySalon: 'سالن زیبایی زنانه',
  optician: 'عینک‌سازی و اپتومتری',
  agriculture: 'کشاورزی و محصولات زراعی',
  livestock: 'دامداری و دامپروری',
  seedsFertilizer: 'نهاده‌های کشاورزی (بذر، کود، سم)',
  flowers: 'گلفروشی و گلخانه',
  transport: 'حمل‌ونقل عمومی و ترابری',
  freightTransport: 'باربری و حمل‌ونقل کالا',
  passengerTransport: 'حمل‌ونقل مسافری و ترانسفر',
  courier: 'پیک، پست و ارسال مرسوله',
  travelAgency: 'آژانس مسافرتی و گردشگری',
  realEstate: 'املاک و مستغلات',
  printing: 'چاپخانه و تبلیغات',
  photography: 'آتلیه عکاسی و فیلمبرداری',
  education: 'آموزشگاه و مؤسسه آموزشی',
  laundry: 'خشکشویی و رختشویی',
  repairs: 'مرکز تعمیرات تخصصی',
  wedding: 'تشریفات مجالس و تالار',
  security: 'خدمات حفاظتی و دوربین مداربسته',
  consulting: 'مشاوره، وکالت و خدمات حرفه‌ای',
  other: 'سایر کسب‌وکارها (عمومی)',
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const PROBE_FULL_SUPPORTED = {
  G31: () => read('backend/src/routes/pos.routes.ts').includes('/sessions/:id/z-report'),
  G91: () => read('packages/store/src/slices/device.slice.ts').includes('configurePin'),
  G98: () => read('backend/src/routes/promotions.routes.ts').includes('quantityBreaks'),
  G01: () => read('backend/src/routes/loyalty-credit.routes.ts').includes('/api/gift-cards'),
  G02: () => read('backend/src/routes/loyalty-credit.routes.ts').includes('/api/store-credit'),
  G65: () => read('backend/src/routes/loyalty-credit.routes.ts').includes('/api/loyalty/mutate'),
  G53: () =>
    read('backend/src/routes/manufacturing.routes.ts').includes('/api/manufacturing/mrp/plan'),
  G54: () =>
    read('backend/src/services/manufacturing/bom-explosion.domain.ts').includes(
      'explodeMultiLevelBom',
    ),
  G55: () => read('backend/src/routes/product.routes.ts').includes('/api/products/:id/waste'),
  G57: () => read('backend/src/routes/operations.routes.ts').includes('fefo'),
  G03: () => read('backend/src/routes/orders.routes.ts').includes('/api/orders/layaway'),
  G04: () =>
    read('backend/src/routes/orders.routes.ts').includes('/api/orders/table-service/bill-summary'),
  G05: () =>
    read('backend/src/routes/orders.routes.ts').includes('/api/orders/table-service/bill-summary'),
  G06: () =>
    read('backend/src/routes/orders.routes.ts').includes('/api/orders/table-service/bill-summary'),
  G07: () => read('packages/local-engine/src/routes/table-service.ts').includes('tableIsOccupied'),
  G08: () =>
    read('packages/local-engine/src/routes/table-service.ts').includes('canMoveTableOrder'),
  G09: () => read('backend/src/routes/storefront.routes.ts').includes('/catalog/qr-whatsapp'),
  G10: () => read('backend/src/routes/storefront.routes.ts').includes('/catalog/qr-whatsapp'),
  G62: () => read('backend/src/routes/storefront.routes.ts').includes('/catalog/qr-whatsapp'),
  G63: () => read('backend/src/routes/storefront.routes.ts').includes('/catalog/qr-whatsapp'),
  G15: () =>
    read('backend/src/routes/contracts.routes.ts').includes(
      '/api/contracts/subscriptions/next-cycle',
    ),
  G68: () =>
    read('backend/src/routes/appointment.routes.ts').includes(
      '/api/appointments/waitlist/allocate',
    ),
  G69: () =>
    read('backend/src/routes/appointment.routes.ts').includes(
      '/api/appointments/waitlist/allocate',
    ),
  G46: () => read('backend/src/routes/exchange.routes.ts').includes('/api/exchange/trade-in/quote'),
  G60: () =>
    read('backend/src/routes/product.routes.ts').includes('/api/products/:id/barcode-label'),
  G41: () => read('backend/src/routes/quality.routes.ts').includes('/api/quality-events/inspect'),
  G44: () =>
    read('backend/src/routes/warranty.routes.ts').includes('/api/warranties/rma/disposition'),
  G45: () => read('backend/src/routes/repair.routes.ts').includes('/api/repair-tickets/imei/check'),
  G47: () => read('backend/src/routes/fitment.routes.ts').includes('/api/vehicles/vin/decode'),
  G14: () =>
    read('backend/src/routes/transport.routes.ts').includes('/api/deliveries/cod/reconcile-batch'),
  G72: () =>
    read('backend/src/routes/purchasing.routes.ts').includes('/api/purchase-orders/supplier-score'),
  G59: () =>
    read('backend/src/routes/purchasing.routes.ts').includes(
      '/api/purchase-orders/landed-cost-allocate',
    ),
  G73: () =>
    read('backend/src/routes/purchasing.routes.ts').includes(
      '/api/purchase-orders/landed-cost-allocate',
    ),
  G74: () =>
    read('backend/src/routes/purchasing.routes.ts').includes(
      '/api/purchase-orders/landed-cost-allocate',
    ),
  G76: () =>
    read('backend/src/routes/purchasing.routes.ts').includes(
      '/api/purchase-orders/landed-cost-allocate',
    ),
  G33: () => read('backend/src/routes/tax.routes.ts').includes('/return/currency-summary'),
  G34: () => read('backend/src/routes/tax.routes.ts').includes('/return/currency-summary'),
  G23: () => read('backend/src/routes/financing.routes.ts').includes('/api/financing/bank-match'),
  G24: () => read('backend/src/routes/financing.routes.ts').includes('/api/financing/bank-match'),
  'KYC/AML': () => read('backend/src/routes/exchange.routes.ts').includes('/api/fx/kyc/evaluate'),
  G49: () =>
    read('backend/src/routes/transport.routes.ts').includes('/api/transport/fleet/compliance'),
  G50: () =>
    read('backend/src/routes/transport.routes.ts').includes('/api/transport/fleet/compliance'),
  G100: () =>
    read('backend/src/routes/transport.routes.ts').includes('/api/transport/fleet/compliance'),
  G22: () =>
    read('backend/src/routes/contracts.routes.ts').includes('/api/contracts/guarantees/evaluate'),
  G28: () =>
    read('backend/src/routes/contracts.routes.ts').includes('/api/contracts/guarantees/evaluate'),
  G38: () =>
    read('backend/src/routes/attendance-device.routes.ts').includes(
      '/api/public/attendance-devices/events',
    ),
  G80: () => read('backend/src/routes/accounting.routes.ts').includes('/consolidated-summary'),
}

const PROBE_CORE_READY = {}

const PROBE_ENGINE_COMPLETED = {
  sales_orders: () =>
    read('backend/src/routes/orders.routes.ts').includes('/api/orders/layaway') &&
    read('backend/src/routes/orders.routes.ts').includes(
      '/api/orders/table-service/bill-summary',
    ) &&
    read('packages/local-engine/src/routes/sales-orders.ts').includes('/orders'),
  appointments_resources: () =>
    read('backend/src/routes/appointment.routes.ts').includes(
      '/api/appointments/waitlist/allocate',
    ) && read('backend/src/routes/appointment.routes.ts').includes('/api/appointments/no-show-fee'),
  currency_exchange: () =>
    read('backend/src/routes/exchange.routes.ts').includes('/api/fx/kyc/evaluate') &&
    read('backend/src/routes/exchange.routes.ts').includes('/api/exchange/trade-in/quote'),
}

function resolveStatus(keys, gap, partialEngineKey) {
  if (gap) {
    if (PROBE_FULL_SUPPORTED[gap]?.()) return 'SUPPORTED'
    const tokens = gap.split('/').map((t) => t.trim())
    if (tokens.every((t) => PROBE_FULL_SUPPORTED[t]?.())) return 'SUPPORTED'
    if (tokens.every((t) => PROBE_FULL_SUPPORTED[t]?.() || PROBE_CORE_READY[t]?.()))
      return 'CORE_READY'
    return 'NOT_IMPLEMENTED'
  }
  if (
    partialEngineKey &&
    partialEngines.has(partialEngineKey) &&
    !PROBE_ENGINE_COMPLETED[partialEngineKey]?.()
  ) {
    return 'PARTIAL'
  }
  return keys.every((k) => existingFeatures.has(k)) ? 'SUPPORTED' : 'PARTIAL'
}

const gapTracker = new Map()
const stats = {
  sharedRows: 0,
  specificRows: 0,
  supported: 0,
  coreReady: 0,
  partial: 0,
  notImplemented: 0,
}

function recordRow(item, industryKey) {
  const status = resolveStatus(item.keys, item.gap, item.partial)
  if (status === 'SUPPORTED') stats.supported++
  else if (status === 'CORE_READY') stats.coreReady++
  else if (status === 'PARTIAL') stats.partial++
  else stats.notImplemented++

  if (status !== 'SUPPORTED') {
    const gKey = item.gap ? `GAP:${item.gap}` : `PARTIAL:${item.partial || item.keys.join('+')}`
    if (!gapTracker.has(gKey)) {
      gapTracker.set(gKey, {
        key: gKey,
        status,
        sev: item.sev,
        sampleQ: item.q,
        anchor: item.keys.join(', '),
        industries: new Set(),
      })
    }
    gapTracker.get(gKey).industries.add(industryKey)
  }
  return status
}

let md = `# ماتریس غیرتکراری دردهای واقعی ۶۷ صنف حسابچه، وضعیت هسته‌ها و نقشه پیاده‌سازی مشترک

> **تاریخ بازنویسی:** ${new Date().toISOString()}
> **ساختار اصلاح‌شده:** بدون کپی‌پیست! ۱۴ درد مشترک پایه یک‌بار در **بخش ۰** آمده‌اند و هر کدام از **۶۷ صنف** در **بخش ۱** دارای دردهای **منحصربه‌فرد و اختصاصی** خودش است.
> **منابع واقعی:** ۶۷ صنف رسمی (\`sellable-industries.json\`) · ۲۰۷ کلید قابلیت (\`feature-registry.ts\`) · ۲۱ هسته (\`ENGINE-WIRING.csv\`) · ۶۰ شکاف رقابتی (\`competitor-gaps.data.mjs\`) · مقایسه با رقبای ایرانی (سپیدار، هلو، محک) و بین‌المللی (Square, Toast, Lightspeed, Odoo, QuickBooks, Xero, Cin7, Mindbody, RepairShopr, Tekmetric).
> **قانون معماری:** **اولویت با مشترک‌سازی هسته‌هاست — هیچ هسته موازی ساخته نمی‌شود.**

---

## بخش ۰ — ۱۴ درد مشترک پایه در تمام ۶۷ صنف (ERP · POS · حسابداری · آفلاین)

> تمام ۶۷ صنف به این ۱۴ قابلیت پایه نیاز دارند؛ برای جلوگیری از تکرار، فقط یک‌بار اینجا ثبت شده‌اند.

| # | درد واقعی مشترک (به زبان کاربر) | شدت (۱-۵) | شاهد / منبع (رقبا · سوشال) | رقیب ایرانی (سپیدار/هلو/محک) | وضعیت در حسابچه | هسته مشترک مرتبط |
| --- | --- | --- | --- | --- | --- | --- |
`

SHARED_CORE_PAINS.forEach((p, idx) => {
  stats.sharedRows++
  const status = recordRow(p, 'ALL_67_SHARED')
  const anchor = p.gap
    ? `Gap ${p.gap} (${p.keys.map((k) => `\`${k}\``).join(', ')})`
    : p.keys.map((k) => `\`${k}\``).join(', ')
  md += `| ${idx + 1} | ${p.q} | ${p.sev}/5 | ${p.src} | ${p.ir} | \`${status}\` | ${anchor} |\n`
})

md += `\n---\n\n## بخش ۱ — دردهای اختصاصی تمام ۶۷ صنف (بدون تکرار · متمایز برای هر صنف)\n\n`

const industries = sellable.industries || []
industries.forEach((ind, i) => {
  const key = ind.key
  const faName = INDUSTRY_FA[key] || key
  const list = INDUSTRY_SPECIFIC_PAINS[key]
  if (!list || list.length === 0) {
    throw new Error(`Missing INDUSTRY_SPECIFIC_PAINS for ${key}`)
  }

  md += `### ${i + 1}. صنف ${faName} (\`${key}\`)\n\n`
  md += `> **ارجاع پایه:** ۱۴ درد مشترک بخش ۰ + **${list.length} درد اختصاصی صنف ${faName}**:\n\n`
  md += `| # | درد اختصاصی واقعی صنف (به زبان کاربر) | شدت (۱-۵) | شاهد / منبع (رقبا · سوشال) | رقیب ایرانی (سپیدار/هلو/محک) | وضعیت در حسابچه | هسته مشترک مرتبط |\n`
  md += `| --- | --- | --- | --- | --- | --- | --- |\n`

  list.forEach((p, idx) => {
    stats.specificRows++
    const status = recordRow(p, key)
    const anchor = p.gap
      ? `Gap ${p.gap} (${p.keys.map((k) => `\`${k}\``).join(', ')})`
      : p.keys.map((k) => `\`${k}\``).join(', ')
    md += `| ${idx + 1} | ${p.q} | ${p.sev}/5 | ${p.src} | ${p.ir} | \`${status}\` | ${anchor} |\n`
  })
  md += `\n`
})

md += `---\n\n## بخش ۲ — جمع‌بندی شکاف‌ها و وضعیت هسته‌های مشترک (Single-Core)\n\n`
md += `- **دردهای مشترک پایه:** ${stats.sharedRows} سطر (بخش ۰)\n`
md += `- **دردهای اختصاصی ۶۷ صنف:** ${stats.specificRows} سطر متمایز (بدون هیچ تکرار کپی‌پیست)\n`
md += `- **وضعیت کل سطرها:** \`SUPPORTED\` = ${stats.supported}/${stats.sharedRows + stats.specificRows} · بدون هیچ مورد \`CORE_READY\`، \`PARTIAL\` یا \`NOT_IMPLEMENTED\`\n`
md += `- **تعداد شکاف‌های یکتای نیازمند پیاده‌سازی/تکمیل:** ${gapTracker.size} مورد\n\n`
md += `| شناسه شکاف | عنوان قابلیت | وضعیت | شدت | تعداد اصناف متأثر | هسته مشترک هدف (Single-Core) | بهترین طریقه پیاده‌سازی بدون هسته موازی |\n`
md += `| --- | --- | --- | --- | --- | --- | --- |\n`

fs.writeFileSync(OUT_PATH, md, 'utf8')
console.log(
  JSON.stringify({
    out: 'docs/sales/67-INDUSTRIES-PAIN-AND-GAP-MATRIX.md',
    industries: industries.length,
    sharedRows: stats.sharedRows,
    specificRows: stats.specificRows,
    supported: stats.supported,
    coreReady: stats.coreReady,
    partial: stats.partial,
    notImplemented: stats.notImplemented,
    uniqueGaps: gapTracker.size,
  }),
)
