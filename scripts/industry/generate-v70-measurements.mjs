import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { formatMarkdown } from '../lib/format-markdown.mjs'

const ROOT = 'C:/Users/hamed/Desktop/hisabche'
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// ---------- inventories ----------
const routes = readdirSync(join(ROOT, 'backend/src/routes'))
  .filter((f) => f.endsWith('.routes.ts'))
  .map((f) => f.replace('.routes.ts', ''))
const services = readdirSync(join(ROOT, 'backend/src/services'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const sqlFiles = readdirSync(join(ROOT, 'docs')).filter((f) => f.endsWith('.sql'))
const tables = new Set()
for (const f of sqlFiles) {
  const sql = read(`docs/${f}`)
  for (const m of sql.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi,
  )) {
    tables.add(m[1].toLowerCase())
  }
}

const registrySrc = read('packages/validation/src/schemas/feature-registry.ts')
const featureKeys = [...registrySrc.matchAll(/^\s{2}'([a-z0-9_.]+)':\s*\{/gm)].map((m) => m[1])

const industrySrc = read('packages/validation/src/schemas/industry-profiles.ts')
const industryBlock = industrySrc.slice(
  industrySrc.indexOf('export const INDUSTRY_KEYS'),
  industrySrc.indexOf('] as const'),
)
const industryIds = [...industryBlock.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1])

// ---------- registry doc: per-industry capabilities ----------
const registryDoc = read('docs/industries/INDUSTRY-REGISTRY.md').split(/\r?\n/)
const rows = []
for (const line of registryDoc) {
  const m = line.match(
    /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/,
  )
  if (!m) continue
  const caps = m[7]
  const available = [...caps.matchAll(/available:\s*([^·|]+)/g)]
    .flatMap((x) => x[1].split(',').map((s) => s.trim()))
    .filter(Boolean)
  const partial = [...caps.matchAll(/partial:\s*([^·|]+)/g)]
    .flatMap((x) => x[1].split(',').map((s) => s.trim()))
    .filter(Boolean)
  const planned = [...caps.matchAll(/planned:\s*([^·|]+)/g)]
    .flatMap((x) => x[1].split(',').map((s) => s.trim()))
    .filter(Boolean)
  rows.push({
    n: Number(m[1]),
    id: m[2],
    archetype: m[5],
    available,
    partial,
    planned,
    raw: caps.replace(/—/g, '').trim(),
  })
}

const byStatus = {
  available: rows.reduce((a, r) => a + r.available.length, 0),
  partial: rows.reduce((a, r) => a + r.partial.length, 0),
  planned: rows.reduce((a, r) => a + r.planned.length, 0),
}
const noSpecial = rows.filter((r) => r.available.length === 0 && r.partial.length === 0)
const archetypes = {}
for (const r of rows) archetypes[r.archetype] = (archetypes[r.archetype] ?? 0) + 1

// ---------- probes ----------
const PROBES = [
  ['G01', 'کارت هدیه', ['gift_card', 'giftcard', 'voucher']],
  ['G02', 'اعتبار فروشگاه', ['store_credit', 'credit_note']],
  ['G03', 'فروش اقساطی/امانی', ['layaway', 'hold_sale']],
  ['G04', 'انعام و تقسیم آن', ['tip_pool', 'tips']],
  ['G05', 'حق سرویس', ['service_charge']],
  ['G06', 'تقسیم صورتحساب', ['split_bill', 'split_bill']],
  ['G07', 'نقشه میز', ['table_map', 'table_order', 'dine_in']],
  ['G08', 'نمایشگر آشپزخانه', ['kitchen_display', 'kds']],
  ['G09', 'سفارش آنلاین', ['online_order', 'web_order']],
  ['G10', 'منوی QR', ['qr_menu', 'digital_menu']],
  ['G11', 'برنامه‌ریزی مسیر', ['route_plan', 'route_optim', 'trip_plan']],
  ['G12', 'اثبات تحویل', ['proof_of_delivery', 'pod_signature']],
  ['G13', 'اپ راننده', ['driver_app', 'driver_shift']],
  ['G14', 'تسویه COD', ['cod_recon', 'cash_on_delivery']],
  ['G15', 'اشتراک مشتری', ['customer_subscription']],
  ['G16', 'صورتحساب مصرفی', ['metered', 'usage_billing']],
  ['G17', 'پیگیری بدهی (dunning)', ['dunning', 'collection_letter']],
  ['G18', 'جریمه دیرکرد', ['late_fee']],
  ['G19', 'پورتال مشتری', ['customer_portal']],
  ['G20', 'پورتال تأمین‌کننده', ['vendor_portal', 'supplier_portal']],
  ['G21', 'امضای الکترونیک', ['esign', 'e_signature']],
  ['G22', 'مدیریت اسناد', ['document_management', 'dms']],
  ['G23', 'اتصال بانکی (bank feed)', ['bank_feed', 'open_banking', 'plaid']],
  ['G24', 'قواعد تطبیق بانکی', ['recon_rule', 'matching_rule']],
  ['G25', 'وصول چک', ['cheque_clear', 'post_dated', 'cheque']],
  ['G26', 'سفته/برات', ['promissory', 'bill_of_exchange']],
  ['G27', 'اعتبار اسنادی', ['letter_of_credit']],
  ['G28', 'ضمانت‌نامه بانکی', ['bank_guarantee']],
  ['G29', 'تنخواه', ['petty_cash']],
  ['G30', 'شمارش نقد صندوق', ['cash_count', 'till.cash_movement']],
  ['G31', 'گزارش Z', ['z_report']],
  ['G32', 'تحویل شیفت', ['shift_handover', 'shift_close', 'till.shift_history']],
  ['G33', 'صورتحساب الکترونیکی/مودیان', ['e_invoice', 'moadian', 'fiscal_device']],
  ['G34', 'اظهارنامه ارزش افزوده', ['vat_return', 'tax_filing']],
  ['G35', 'مالیات حقوق و فیش', ['payroll_tax']],
  ['G36', 'سنوات/پایان خدمت', ['gratuity', 'end_of_service']],
  ['G37', 'برنامه شیفت', ['shift_schedule', 'roster']],
  ['G38', 'حضور بیومتریک', ['biometric']],
  ['G39', 'سوابق آموزش', ['training_record', 'certification']],
  ['G40', 'گزارش حادثه', ['incident_report', 'safety_incident']],
  ['G41', 'بازرسی کیفیت', ['quality_check', 'inspection']],
  ['G42', 'کالیبراسیون', ['calibration']],
  ['G43', 'گارانتی', ['warranty']],
  ['G44', 'مرجوعی کالا (RMA)', ['rma', 'return_authorization']],
  ['G45', 'لیست سیاه IMEI', ['imei_blacklist', 'blacklist']],
  ['G46', 'معاوضه (trade-in)', ['trade_in']],
  ['G47', 'تاریخچه خودرو/VIN', ['vehicle_history', 'vin']],
  ['G48', 'آج لاستیک', ['tyre', 'tread']],
  ['G49', 'کارت سوخت', ['fuel_card']],
  ['G50', 'نگهداری ناوگان', ['fleet', 'vehicle_maintenance']],
  ['G51', 'فرمول ساخت (BOM)', ['bill_of_materials', 'bom']],
  [
    'G52',
    'دستور تولید',
    ['production_order', 'manufacturing.work_orders', 'manufacturing.produce'],
  ],
  ['G53', 'برنامه‌ریزی مواد (MRP)', ['mrp', 'material_requirement']],
  ['G54', 'دستور پخت/مواد اولیه', ['recipe', 'ingredient']],
  ['G55', 'ضایعات', ['wastage', 'spoilage']],
  ['G56', 'شماره بچ', ['batch_lot', 'lot_number', 'stock.batches', 'batch']],
  ['G57', 'FEFO', ['fefo']],
  ['G58', 'قفسه/محل نگهداری', ['bin_location', 'storage_location']],
  ['G59', 'برداشت/بسته‌بندی/ارسال', ['pick_list', 'pack_ship', 'wave_pick']],
  ['G60', 'چاپ برچسب بارکد', ['label_print', 'barcode_label']],
  ['G61', 'همگام‌سازی مارکت‌پلیس', ['marketplace', 'shopify', 'woocommerce', 'salla', 'zid']],
  ['G62', 'همگام‌سازی فروشگاه آنلاین', ['ecommerce', 'online_store']],
  ['G63', 'کاتالوگ واتساپ', ['whatsapp_catalog', 'whatsapp']],
  ['G64', 'کمپین پیامکی', ['sms_campaign', 'campaign']],
  ['G65', 'باشگاه مشتریان/امتیاز', ['loyalty', 'points_ledger']],
  ['G66', 'معرفی دوستان', ['referral']],
  ['G67', 'حق عضویت', ['membership_fee']],
  ['G68', 'ظرفیت کلاس', ['class_capacity', 'capacity_rule']],
  ['G69', 'لیست انتظار', ['waitlist']],
  ['G70', 'قاعده کمیسیون', ['commission_rule', 'commission']],
  ['G71', 'تطبیق سه‌طرفه خرید', ['three_way_match', 'threeway']],
  ['G72', 'امتیاز تأمین‌کننده', ['supplier_score']],
  ['G73', 'سفارش باز (blanket)', ['blanket_order']],
  ['G74', 'درخواست خرید', ['requisition']],
  ['G75', 'موجودی امانی', ['consignment']],
  ['G76', 'ارسال مستقیم (dropship)', ['dropship', 'drop_ship']],
  ['G77', 'اعلان ارسال (ASN)', ['advance_ship', 'asn']],
  ['G78', 'بهای تمام‌شده رسیده', ['landed_cost']],
  ['G79', 'حقوق گمرکی/واردات', ['customs', 'duty']],
  ['G80', 'تلفیق چند شرکت', ['consolidation', 'intercompany']],
  ['G81', 'قیمت‌گذاری انتقالی', ['transfer_pricing']],
  ['G82', 'سود و زیان شعبه', ['branch_pnl', 'branch_pl']],
  ['G83', 'مرکز هزینه', ['cost_center', 'dimension']],
  ['G84', 'بودجه', ['budget']],
  ['G85', 'پیش‌بینی جریان نقد', ['forecast']],
  ['G86', 'سناریو', ['scenario']],
  ['G87', 'گردش تأیید', ['approval']],
  ['G88', 'گزارش رخداد', ['audit_log', 'audit']],
  ['G89', 'ورود یکپارچه (SSO)', ['sso', 'saml', 'oidc']],
  ['G90', 'ورود دو مرحله‌ای', ['two_factor', 'mfa', 'totp']],
  ['G91', 'قفل دستگاه', ['device_pin', 'device_lock']],
  ['G92', 'محل نگهداری داده', ['residency']],
  ['G93', 'حقوق داده (DSAR)', ['dsar', 'gdpr']],
  ['G94', 'سیاست نگهداری', ['retention']],
  ['G95', 'اسکن رسید (OCR)', ['ocr', 'receipt_scan']],
  ['G96', 'صورتحساب طرف حساب', ['statement']],
  ['G97', 'فهرست قیمت', ['price_list']],
  ['G98', 'تخفیف پله‌ای', ['volume_discount', 'tier_price']],
  ['G99', 'کوپن/تخفیف', ['coupon', 'promotion']],
  ['G100', 'ثبت بیمه‌نامه', ['insurance_policy']],
]

const compact = (s) => s.toLowerCase().replace(/[_\-.]/g, '')
const hay = {
  route: routes.map((r) => ({ name: r, key: compact(r) })),
  service: services.map((s) => ({ name: s, key: compact(s) })),
  table: [...tables].map((t) => ({ name: t, key: compact(t) })),
  feature: featureKeys.map((k) => ({ name: k, key: compact(k) })),
}

const probeRows = PROBES.map(([id, fa, terms]) => {
  const hits = { route: [], service: [], table: [], feature: [] }
  for (const t of terms) {
    const needle = compact(t)
    for (const kind of ['route', 'service', 'table', 'feature']) {
      for (const h of hay[kind]) {
        if (h.key.includes(needle) && !hits[kind].includes(h.name)) hits[kind].push(h.name)
      }
    }
  }
  const total = Object.values(hits).reduce((a, v) => a + v.length, 0)
  return { id, fa, terms, hits, verdict: total === 0 ? 'PROBE=۰' : 'PROBE>۰' }
})

const missing = probeRows.filter((r) => r.verdict === 'PROBE=۰')

// ---------- doc ----------
const eol = '\n'
const md = []
md.push('# V70.0 — اندازه‌گیری و FINDINGS (بدون تغییر کد محصول)')
md.push('')
md.push('> این سند فقط اندازه‌گیری است. هیچ فایل محصولی در این فاز ویرایش نشد. اعداد از اجرای')
md.push('> `node scripts/industry/generate-v70-measurements.mjs` روی همین working tree می‌آیند.')
md.push('')
md.push('## ۱. خط پایه‌ی مخزن')
md.push('')
md.push('| سنجه | عدد |')
md.push('| --- | --- |')
md.push(`| فایل route (بک‌اند) | **${routes.length}** |`)
md.push(`| پوشه سرویس | **${services.length}** |`)
md.push(`| فایل SQL در \`docs/\` | **${sqlFiles.length}** |`)
md.push(`| جدول استخراج‌شده از SQL | **${tables.size}** |`)
md.push(`| کلید \`FEATURE_REGISTRY\` | **${featureKeys.length}** |`)
md.push(`| صنف در \`INDUSTRY_KEYS\` | **${industryIds.length}** |`)
md.push(`| ردیف خوانده‌شده از رجیستری صنف | **${rows.length}** |`)
md.push('')
md.push(
  '**پیام اصلی:** محصول بزرگ‌تر از گزارش V68/V69 است. نام routeها نشان می‌دهد payroll، دارایی ثابت،',
)
md.push(
  'بانک/خزانه، خرید و RFQ، منابع انسانی، ابعاد، قرارداد و حمل از قبل وجود دارند. پس «۶۰ شکاف» باید از',
)
md.push(
  'probe ساخته شود و هر موردی که در کد هست، \`PRESENT\` علامت بخورد و از فهرست شکاف بیرون بماند.',
)
md.push('')
md.push('## ۲. پوشش قابلیت در ۶۷ صنف (از رجیستری تولیدی)')
md.push('')
md.push(
  `- جمع \`available\`: **${byStatus.available}** · جمع \`partial\`: **${byStatus.partial}** · جمع \`planned\`: **${byStatus.planned}**`,
)
md.push(
  `- صنف‌های بدون هیچ قابلیت اختصاصی: **${noSpecial.length}** (${noSpecial.map((r) => '`' + r.id + '`').join(', ') || '—'})`,
)
md.push(
  `- توزیع archetype: ${Object.entries(archetypes)
    .map(([k, v]) => `\`${k}\`=${v}`)
    .join(' · ')}`,
)
md.push('')
md.push('| # | id | archetype | available | partial | planned |')
md.push('| ---: | --- | --- | ---: | ---: | ---: |')
for (const r of rows) {
  md.push(
    `| ${r.n} | \`${r.id}\` | \`${r.archetype}\` | ${r.available.length} | ${r.partial.length} | ${r.planned.length} |`,
  )
}
md.push('')
md.push('## ۳. probe شکاف‌ها: ۱۰۰ کاندید روی چهار فهرست')
md.push('')
md.push(
  `probe روی نام routeها، پوشه‌های سرویس، جدول‌های SQL و کلیدهای \`FEATURE_REGISTRY\` اجرا شد.`,
)
md.push(
  `نتیجه: **${probeRows.length - missing.length}** ردیف با نام منطبق و **${missing.length}** ردیف بدون هیچ نام منطبق.`,
)
md.push(
  '`PROBE=۰` یعنی «هیچ route/service/table/feature با این نام نیست» — نه «قابلیت وجود ندارد»؛ V70.1 هر ردیف را با خواندن کد تأیید می‌کند.',
)
md.push('')
md.push('| id | موضوع | شرط probe | route | service | table | feature | حکم |')
md.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
for (const r of probeRows) {
  const fmt = (v) => (v.length === 0 ? '۰' : v.slice(0, 2).join(', ') + (v.length > 2 ? '…' : ''))
  md.push(
    `| ${r.id} | ${r.fa} | \`${r.terms.join('/')}\` | ${fmt(r.hits.route)} | ${fmt(r.hits.service)} | ${fmt(r.hits.table)} | ${fmt(r.hits.feature)} | **${r.verdict}** |`,
  )
}
md.push('')
md.push('## ۴. FINDINGS این فاز')
md.push('')
md.push(
  '1. **F9 — «۶۰ شکاف» را نمی‌توان از حدس نوشت.** probe نشان می‌دهد بخش بزرگی از کاندیدها در کد هستند؛',
)
md.push(
  '   هر ادعای غیبت باید چهار فهرست را صفر بدهد. V70.1 فقط از `MISSING`ها (و `PARTIAL`های اثبات‌شده) می‌سازد.',
)
md.push(
  '2. **F10 — رجیستری صنف، منبع درست ماتریس است.** ۶۷ ردیف و archetype هر صنف از سند تولیدی می‌آید؛',
)
md.push('   ماتریس شکاف باید همان archetype را استفاده کند، نه یک نگاشت دستی دوم.')
md.push(
  '3. **F11 — شکاف واقعی محصول، بیشتر «تفکیک صنفی» است تا «قابلیت غایب»:** چند قابلیت عمومی هست',
)
md.push(
  '   (payroll، buying، banking) ولی برای صنف خاص سیم‌کشی نشده؛ V70.1 باید `PARTIAL` را از `MISSING` جدا کند.',
)
md.push(
  '4. **F12 — probe نام‌سطح می‌تواند خطا بدهد.** در اجرای اول G56 (شماره بچ) صفر بود، چون `stock.batches` در فهرست probe نبود؛',
)
md.push('   همین نشان می‌دهد V70.1 بدون تأیید دستی هر ردیف، حق ندارد چیزی را «شکاف» بنامد.')
md.push('')
md.push('## ۵. چیزهایی که در این فاز اندازه‌گیری نشد')
md.push('')
md.push('- تست‌ها دوباره اجرا نشدند؛ اعداد V69.9 (همین درخت، همین روز) به‌عنوان خط پایه ثبت است.')
md.push(
  '- Postgres و jest و بیلد desktop/android همچنان `BLOCKED_EXTERNAL` هستند (دلیل در PROGRESS).',
)
md.push('')

// Committed Markdown goes through prettier; format here so the generator, the
// file on disk and `prettier --check` stay in agreement (see format-markdown.mjs).
const measurementsPath = join(ROOT, 'docs/architecture/V70-MEASUREMENTS.md')
writeFileSync(measurementsPath, await formatMarkdown(measurementsPath, md.join(eol)), 'utf8')

console.log(
  `routes=${routes.length} services=${services.length} sql=${sqlFiles.length} tables=${tables.size} features=${featureKeys.length} industries=${industryIds.length} registryRows=${rows.length}`,
)
console.log(
  `available=${byStatus.available} partial=${byStatus.partial} planned=${byStatus.planned} noSpecial=${noSpecial.length}`,
)
console.log(
  `probes=${probeRows.length} present=${probeRows.length - missing.length} missing=${missing.length}`,
)
console.log('MISSING:', missing.map((r) => `${r.id}:${r.fa}`).join(' | '))
writeFileSync(
  'C:/Users/hamed/AppData/Local/Temp/opencode/v70-probes.json',
  JSON.stringify(
    {
      probeRows,
      rows,
      byStatus,
      counts: {
        routes: routes.length,
        services: services.length,
        tables: tables.size,
        features: featureKeys.length,
      },
    },
    null,
    2,
  ),
  'utf8',
)
