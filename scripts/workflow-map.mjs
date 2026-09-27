// Full Hisabche System Workflow Map (#120) — generated from the code, not written by hand.
//
//   node scripts/workflow-map.mjs      →  docs/SYSTEM-WORKFLOW-MAP.html
//
// Every page under apps/web/app/[lang]/(dashboard) is followed to the shared
// container it renders (packages/ui), the hooks that container and its children
// call (packages/api), the endpoint each hook hits, and the backend route file
// that answers it. Hand-written parts (the login→effect path and «how each number
// is computed») cite a file + symbol, and the script REFUSES to write the map if
// any cited symbol is gone — a map that describes code that no longer exists is
// worse than none (CLAUDE.md G1).
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const rel = (abs) => relative(ROOT, abs).replaceAll('\\', '/')
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

function walk(dir, test, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, test, out)
    else if (test(full)) out.push(full)
  }
  return out
}

// ─── 1. backend routes ──────────────────────────────────────────────────────
const indexSrc = read('backend/src/index.ts')
// Every route file is scanned; index.ts only supplies the prefix a file was
// registered under (named or default import, either quote style).
const fileOfBinding = new Map()
for (const m of indexSrc.matchAll(
  /import\s+(?:\{\s*(\w+)\s*\}|(\w+))\s+from\s+['"]\.\/routes\/([\w.-]+)['"]/g,
)) {
  fileOfBinding.set(m[1] ?? m[2], `${m[3]}.ts`)
}
const prefixOf = new Map(
  readdirSync(join(ROOT, 'backend/src/routes'))
    .filter((f) => f.endsWith('.ts'))
    .map((file) => [file, { file, prefix: '' }]),
)
for (const m of indexSrc.matchAll(
  /register\((\w+)(?:,\s*\{\s*prefix:\s*['"]([^'"]+)['"]\s*\})?\)/g,
)) {
  const entry = prefixOf.get(fileOfBinding.get(m[1]))
  if (entry && m[2]) entry.prefix = m[2]
}
const norm = (p) =>
  p
    .replace(/\?.*$/, '')
    .replace(/\$\{[^}]+\}/g, ':p')
    .replace(/:\w+/g, ':p')
    .replace(/\/+$/, '')
const backendRoutes = []
for (const { file, prefix } of prefixOf.values()) {
  const path = `backend/src/routes/${file}`
  if (!existsSync(join(ROOT, path))) continue
  const src = read(path)
  for (const m of src.matchAll(
    /(?:fastify|app|server|instance)\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*['"`]([^'"`]+)['"`]/g,
  )) {
    backendRoutes.push({
      method: m[1].toUpperCase(),
      path: prefix + (m[2] === '/' ? '' : m[2]),
      file: path,
    })
  }
}
const routeFor = (method, clientPath) => {
  const want = norm('/api' + clientPath)
  return backendRoutes.find((r) => r.method === method && norm(r.path) === want)
}

// ─── 2. hooks → endpoints ───────────────────────────────────────────────────
const hooks = new Map()
for (const abs of walk(join(ROOT, 'packages/api/src/hooks'), (f) => f.endsWith('.ts'))) {
  const src = readFileSync(abs, 'utf8')
  const starts = [...src.matchAll(/export function (use\w+)/g)]
  starts.forEach((m, i) => {
    const body = src.slice(m.index, starts[i + 1]?.index ?? src.length)
    const calls = [
      ...body.matchAll(/apiClient\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*([`'"])(.*?)\2/g),
    ].map((c) => {
      const method = c[1].toUpperCase()
      const route = routeFor(method, c[3])
      return { method, path: c[3].replace(/\$\{[^}]+\}/g, ':id'), route }
    })
    hooks.set(m[1], { file: rel(abs), mutation: body.includes('useMutation'), calls })
  })
}

// ─── 3. pages → containers → hooks ──────────────────────────────────────────
const uiFiles = walk(join(ROOT, 'packages/ui/src'), (f) => /\.tsx?$/.test(f))
const uiSrc = new Map(uiFiles.map((f) => [f, readFileSync(f, 'utf8')]))
const barrel = readFileSync(join(ROOT, 'packages/ui/src/index.ts'), 'utf8')
const defining = (name) => {
  // `export { customersContainer as customersPage } from '…'` in the barrel.
  const alias = barrel.match(new RegExp(`export\\s*\\{\\s*(\\w+)\\s+as\\s+${name}\\s*\\}`))?.[1]
  const real = alias ?? name
  return [...uiSrc].find(([, s]) =>
    new RegExp(`export\\s+(?:const|function)\\s+${real}\\b`).test(s),
  )?.[0]
}

function resolveImport(from, spec) {
  const base = resolve(dirname(from), spec)
  for (const c of [base + '.tsx', base + '.ts', join(base, 'index.tsx'), join(base, 'index.ts')])
    if (uiSrc.has(c)) return c
  return null
}
function closure(file, depth = 0, seen = new Set()) {
  if (!file || seen.has(file) || depth > 4) return seen
  seen.add(file)
  for (const m of uiSrc.get(file).matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g)) {
    // Components AND packages/ui/src/hooks — containers often reach the API
    // through a page hook (e.g. hooks/invoices/use-invoices-page).
    const next = resolveImport(file, m[1])
    if (next) closure(next, depth + 1, seen)
  }
  return seen
}
const apiImports = (src) =>
  [...src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@hisabche\/api['"]/g)].flatMap(
    (m) =>
      m[1]
        .split(',')
        .map(
          (s) =>
            s
              .trim()
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)[0],
        )
        .filter((s) => /^use[A-Z]/.test(s)),
  )

const PAGES_DIR = join(ROOT, 'apps/web/app/[lang]/(dashboard)')
const pages = walk(PAGES_DIR, (f) => f.endsWith('page.tsx'))
  .map((abs) => {
    const route =
      '/{lang}/' +
      rel(abs)
        .replace(/^apps\/web\/app\/\[lang\]\/\(dashboard\)\/?/, '')
        .replace(/\/?page\.tsx$/, '')
    // The page plus the web files it pulls in relatively (a page may just
    // re-export another page, or render a local client component).
    const webFiles = new Set()
    const followWeb = (file, depth) => {
      if (webFiles.has(file) || depth > 3) return
      webFiles.add(file)
      for (const m of readFileSync(file, 'utf8').matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g)) {
        const base = resolve(dirname(file), m[1])
        const hit = [
          base + '.tsx',
          base + '.ts',
          join(base, 'page.tsx'),
          join(base, 'index.tsx'),
        ].find((c) => existsSync(c))
        if (hit) followWeb(hit, depth + 1)
      }
    }
    followWeb(abs, 0)
    const webSrc = [...webFiles].map((f) => readFileSync(f, 'utf8')).join('\n')
    const fromUi = [...webSrc.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@hisabche\/ui['"]/g)]
      .flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]))
      .filter((s) => /(Container|Page|View|Client|Tab|Panel)$/.test(s))
    // next/dynamic: import("@hisabche/ui").then((m) => m.customersPage)
    for (const m of webSrc.matchAll(
      /import\(\s*['"]@hisabche\/ui['"]\s*\)\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.(\w+)/g,
    ))
      fromUi.push(m[2])
    const redirectTo =
      webSrc.match(/(?:permanentRedirect|redirect)\(\s*[`'"]([^`'"]+)[`'"]/)?.[1] ?? null
    const files = new Set()
    const roots = []
    for (const name of fromUi) {
      const f = defining(name)
      if (f) {
        roots.push({ name, file: rel(f) })
        closure(f, 0, files)
      }
    }
    const hookNames = [
      ...new Set([...files].flatMap((f) => apiImports(uiSrc.get(f))).concat(apiImports(webSrc))),
    ].sort()
    return {
      route: route.replace(/\/$/, '') || '/{lang}',
      page: rel(abs),
      roots,
      files: [...files].map(rel),
      hookNames,
      redirectTo,
    }
  })
  .sort((a, b) => a.route.localeCompare(b.route))

// ─── 4. shared UI: files reached from 3+ pages ──────────────────────────────
const reach = new Map()
for (const p of pages) for (const f of p.files) reach.set(f, (reach.get(f) ?? 0) + 1)
const shared = [...reach]
  .filter(([f, n]) => n >= 3 && !f.includes('/containers/'))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)

// ─── 5. hand-written, symbol-checked parts ──────────────────────────────────
const cite = (file, symbol) => {
  if (!existsSync(join(ROOT, file)) || !read(file).includes(symbol))
    throw new Error(`cited symbol missing: ${file} → ${symbol}`)
  return `<code>${esc(file)}</code> · <code>${esc(symbol)}</code>`
}
const FLOW = [
  [
    'ورود',
    'فرم ورود ایمیل/رمز را به سرور می‌فرستد؛ سرور session و workspace ها را برمی‌گرداند.',
    cite('backend/src/routes/auth.routes.ts', "'/api/auth/login'"),
  ],
  [
    'آماده‌شدن توکن',
    'store بعد از hydrate شدن اعلام آمادگی می‌کند؛ تا آن لحظه هیچ درخواستی بدون Authorization نمی‌رود.',
    cite('packages/api/src/lib/tokenProvider.ts', 'markTokenReady'),
  ],
  [
    'احراز هویت هر درخواست',
    'توکن بررسی و session کش‌شده (کلید sha256) خوانده می‌شود.',
    cite('backend/src/middleware/auth.middleware.ts', 'authCacheKey'),
  ],
  [
    'مرز workspace',
    'عضویت در workspace و نقش از سرور خوانده و در request.tenancy گذاشته می‌شود — تنها مرز امنیتی.',
    cite('backend/src/middleware/workspace.middleware.ts', 'requireWorkspaceContext'),
  ],
  [
    'قاعده‌ی دامنه',
    'سرویس با TenancyContext کار می‌کند؛ مبلغ را سرور از خطوط درمی‌آورد؛ سقف پلن قبل از نوشتن چک می‌شود.',
    cite('backend/src/services/plan-limits.service.ts', 'assertWithinLimit'),
  ],
  [
    'نوشتن اتمیک',
    'نوشتن چند-جدولی یک تابع Postgres است (مثلاً پرداخت)؛ تکرار با کلید idempotency همان نتیجه را برمی‌گرداند.',
    cite('backend/src/services/payments/payments.repository.ts', 'payments_record_keyed'),
  ],
  [
    'ابطال کش مالی',
    'بعد از هر تغییر پول/موجودی شمارنده‌ی نسل کش مالی بالا می‌رود تا هیچ instance عدد کهنه نخواند.',
    cite('backend/src/utils/money-cache.ts', 'invalidateMoneyCaches'),
  ],
  [
    'رویداد و اعلان',
    'رویداد در event_log ثبت و با claim اتمیک پردازش می‌شود؛ ایمیل از صف پایدار می‌رود.',
    cite('backend/src/services/email-outbox.ts', 'claimEmails'),
  ],
  [
    'برگشت به صفحه',
    'React Query کلیدهای مربوط را invalidate می‌کند و صفحه عدد تازه را از سرور می‌خواند.',
    cite('packages/api/src/hooks/billing.ts', 'invalidateQueries'),
  ],
]
const NUMBERS = [
  [
    'فروش کل، فروش امروز، بدهی مشتریان، ارزش انبار (داشبورد)',
    'اول از aggregate خود Postgres؛ فقط فاکتورهای فروش (خرید جدا)، هر ارز جدا. بدهی = total − paid روی فاکتورهای باز.',
    cite('backend/src/services/analytics.service.ts', 'async getDashboardKpis'),
    cite('backend/src/services/aggregates/analytics-aggregates.ts', 'dashboardKpisFromAggregate'),
  ],
  [
    'رشد ماهانه',
    'درآمد این ماه نسبت به ماه قبل، درصد.',
    cite(
      'backend/src/services/aggregates/analytics-aggregates.ts',
      'export function growthPercent',
    ),
  ],
  [
    '«نمایش بر مبنای» ارز در داشبورد',
    'فقط نمایش: مبلغ × نرخ ثبت‌شده‌ی همان روز؛ بدون نرخ «نرخ ثبت نشده» نه عدد تبدیل‌نشده. نرخ از فرم «[عدد][ارز] = [عدد][ارز]».',
    cite(
      'packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx',
      'fmtInBasis',
    ),
    cite('packages/ui/src/lib/warehouse/rate-from-pair.ts', 'export function rateFromPair'),
  ],
  [
    'سود هر کالا و سود خالص (به تفکیک ارز)',
    'فروش خالص − بهای تمام‌شده (لایه‌های هزینه) − حقوق؛ هر ارز یک گزارش جدا، هرگز جمع نمی‌شوند.',
    cite('backend/src/services/accounting/accounting.service.ts', 'getProfitReportsByCurrency'),
    cite('backend/src/services/accounting/profit-report.domain.ts', 'export function'),
  ],
  [
    'تراز آزمایشی / صورت سود و زیان',
    'جمع بدهکار/بستانکار اسناد ثبت‌شده در Postgres.',
    cite(
      'backend/src/services/accounting/accounting.repository.ts',
      "rpc('accounting_trial_balance'",
    ),
  ],
  [
    'موجودی هر انبار',
    'از حرکت‌های انبار (stock_movements) به تفکیک انبار.',
    cite('backend/src/services/inventory/warehouse-summary.domain.ts', 'export function'),
  ],
  [
    '«مصرف شما» در صورت‌حساب',
    'شمارش دقیق (count exact) در برابر سقف مؤثر = پیش‌فرض ← تنظیم پلن ← استثنای workspace.',
    cite('backend/src/services/billing.service.ts', 'getUsageReport'),
    cite('backend/src/services/plan-limits.service.ts', 'effectiveLimits'),
  ],
  [
    'عدد تب‌های رخدادها (1.3k)',
    'count exact head روی هر فیلتر؛ نمایش فشرده با گرد کردن به پایین.',
    cite('backend/src/services/activity.service.ts', 'getFilterCounts'),
    cite('packages/formatting/src/compact.ts', 'formatCompactCount'),
  ],
  [
    'مانیتور CPU/RAM در /docs و صفحه‌ی سرورهای ادمین',
    'سطح ماشین/کانتینر (cgroup، وگرنه دلتای زمان CPU)، هر instance با heartbeat در Redis.',
    cite('backend/src/utils/system-metrics.ts', 'export'),
    cite('backend/src/services/instance-registry.ts', 'listInstances'),
  ],
]

// ─── 6. HTML ────────────────────────────────────────────────────────────────
const hookRow = (name) => {
  const h = hooks.get(name)
  if (!h)
    return `<li><code>${esc(name)}</code> <span class="muted">(هوک محلی/غیرشبکه‌ای)</span></li>`
  const calls = h.calls.length
    ? h.calls
        .map(
          (c) =>
            `<span class="m m-${c.method.toLowerCase()}">${c.method}</span> <code>${esc(c.path)}</code> → ${c.route ? `<code class="be">${esc(c.route.file.replace('backend/src/routes/', ''))}</code>` : '<span class="warn">route پیدا نشد</span>'}`,
        )
        .join('<br>')
    : '<span class="muted">بدون درخواست مستقیم</span>'
  return `<li><span class="kind ${h.mutation ? 'act' : 'read'}">${h.mutation ? 'عمل' : 'خواندن'}</span> <code>${esc(name)}</code><div class="calls">${calls}</div></li>`
}
const unmatched = [...hooks].flatMap(([n, h]) =>
  h.calls.filter((c) => !c.route).map((c) => `${c.method} ${c.path} (${n})`),
)
const pageCards = pages
  .map((p) => {
    const acts = p.hookNames.filter((n) => hooks.get(n)?.mutation)
    const reads = p.hookNames.filter((n) => !hooks.get(n)?.mutation)
    if (p.redirectTo && p.roots.length === 0) {
      return `<details class="page" id="${esc(p.route)}"><summary><code class="route">${esc(p.route)}</code><span class="counts">ریدایرکت</span></summary>
<p class="src">صفحه: <code>${esc(p.page)}</code><br>این آدرس قدیمی است و دائماً به <code>${esc(p.redirectTo)}</code> می‌رود.</p></details>`
    }
    return `<details class="page" id="${esc(p.route)}"><summary><code class="route">${esc(p.route)}</code><span class="counts">${reads.length} خواندن · ${acts.length} عمل</span></summary>
<p class="src">صفحه: <code>${esc(p.page)}</code><br>کامپوننت مشترک: ${p.roots.map((r) => `<code>${esc(r.name)}</code> <span class="muted">${esc(r.file)}</span>`).join('، ') || '<span class="muted">—</span>'}</p>
${acts.length ? `<h4>دکمه‌ها و عمل‌ها (mutation)</h4><ul>${acts.map(hookRow).join('')}</ul>` : ''}
${reads.length ? `<h4>داده‌هایی که صفحه می‌خواند</h4><ul>${reads.map(hookRow).join('')}</ul>` : ''}
</details>`
  })
  .join('\n')

const html = `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>نقشه‌ی جریان سیستم</title>
<style>
:root{--bg:#f7f8fa;--panel:#fff;--line:#dfe3ea;--fg:#1a1f29;--fg2:#5b6474;--acc:#2f6fdb;--ok:#1d8a55;--warn:#b5471f;--act:#8a4bd6}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0e1116;--panel:#161b22;--line:#2a313c;--fg:#e6eaf0;--fg2:#98a2b3;--acc:#6ea2ff;--ok:#4cc38a;--warn:#ff8a5c;--act:#b98cff}}
:root[data-theme=dark]{--bg:#0e1116;--panel:#161b22;--line:#2a313c;--fg:#e6eaf0;--fg2:#98a2b3;--acc:#6ea2ff;--ok:#4cc38a;--warn:#ff8a5c;--act:#b98cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.7 Vazirmatn,Tahoma,system-ui,sans-serif;padding:24px 16px}
main{max-width:1100px;margin:0 auto}h1{margin:0 0 4px;font-size:24px}h2{margin:36px 0 12px;font-size:18px;border-bottom:1px solid var(--line);padding-bottom:6px}
h4{margin:12px 0 4px;font-size:13px;color:var(--fg2)}.muted{color:var(--fg2)}.warn{color:var(--warn)}code{font:12px ui-monospace,Consolas,monospace;direction:ltr;unicode-bidi:embed;overflow-wrap:anywhere}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 14px}.stat b{font-size:18px;display:block}
ol.flow{counter-reset:s;list-style:none;padding:0;margin:0}ol.flow li{counter-increment:s;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px 10px 14px;margin:0 0 8px;position:relative;padding-inline-start:48px}
ol.flow li::before{content:counter(s);position:absolute;inset-inline-start:12px;top:10px;width:26px;height:26px;border-radius:50%;background:var(--acc);color:var(--bg);display:grid;place-items:center;font-weight:700}
.cite{display:block;font-size:12px;margin-top:4px}table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:start;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}th{font-size:12px;color:var(--fg2)}
.tablewrap{overflow-x:auto}details.page{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin:0 0 8px;padding:8px 14px}
summary{cursor:pointer;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.route{font-weight:700;color:var(--acc)}.counts{color:var(--fg2);font-size:12px}
.src{font-size:12px}ul{margin:0;padding:0;list-style:none}li{padding:4px 0;border-top:1px dashed var(--line)}.calls{padding-inline-start:12px;font-size:12px}
.kind{font-size:11px;border-radius:6px;padding:0 6px;border:1px solid}.kind.act{color:var(--act)}.kind.read{color:var(--ok)}
.m{font:700 10px ui-monospace,monospace;padding:0 4px;border-radius:4px;border:1px solid var(--line)}.m-post,.m-put,.m-patch{color:var(--act)}.m-delete{color:var(--warn)}.m-get{color:var(--ok)}
input{width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--fg);font:inherit;margin-bottom:10px}
</style></head><body><main>
<h1>نقشه‌ی جریان کامل حسابچه</h1>
<p class="muted">تولیدشده از کد با <code>node scripts/workflow-map.mjs</code> — هر صفحه ← کامپوننت مشترک ← هوک ← endpoint ← فایل route بک‌اند. بخش‌های دستی به فایل و نماد واقعی ارجاع می‌دهند و اسکریپت اگر نمادی حذف شده باشد فایل را نمی‌سازد.</p>
<div class="stats"><div class="stat"><b>${pages.length}</b>صفحه‌ی داشبورد</div><div class="stat"><b>${hooks.size}</b>هوک API</div><div class="stat"><b>${backendRoutes.length}</b>route بک‌اند</div><div class="stat"><b>${unmatched.length}</b>درخواست بدون route قابل‌تطبیق</div></div>

<h2>۱. از ورود تا آخرین اثر</h2>
<ol class="flow">${FLOW.map(([t, d, c]) => `<li><b>${t}</b> — ${d}<span class="cite">${c}</span></li>`).join('')}</ol>

<h2>۲. هر عدد چطور حساب می‌شود</h2>
<div class="tablewrap"><table><thead><tr><th>عدد</th><th>قاعده</th><th>کجا</th></tr></thead><tbody>
${NUMBERS.map(([n, r, ...c]) => `<tr><td>${n}</td><td>${r}</td><td>${c.join('<br>')}</td></tr>`).join('')}
</tbody></table></div>

<h2>۳. صفحه‌ها، دکمه‌ها و داده‌ها</h2>
<input type="search" id="q" placeholder="جستجوی مسیر، هوک یا endpoint…" aria-label="جستجو">
<div id="pages">${pageCards}</div>

<h2>۴. UI مشترک (در ۳ صفحه یا بیشتر)</h2>
<div class="tablewrap"><table><thead><tr><th>فایل</th><th>تعداد صفحه</th></tr></thead><tbody>
${shared.map(([f, n]) => `<tr><td><code>${esc(f)}</code></td><td>${n}</td></tr>`).join('')}
</tbody></table></div>
<p class="muted">وب و دسکتاپ هر دو همین کامپوننت‌های <code>packages/ui</code> را رندر می‌کنند؛ موبایل (Expo) کامپوننت خودش را دارد ولی همان هوک‌ها و endpoint ها را.</p>

<h2>۵. درخواست‌هایی که route بک‌اندشان خودکار پیدا نشد</h2>
<p class="muted">یا route با الگوی دیگری ثبت شده (مثلاً plugin یا مسیر پویا)، یا واقعاً وجود ندارد — هر کدام را باید دستی بررسی کرد.</p>
<ul>${unmatched.map((u) => `<li><code>${esc(u)}</code></li>`).join('') || '<li>هیچ</li>'}</ul>
</main>
<script>
const q=document.getElementById('q');q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();for(const d of document.querySelectorAll('details.page')){const hit=!v||d.textContent.toLowerCase().includes(v);d.style.display=hit?'':'none';if(v&&hit)d.open=true}})
</script>
</body></html>
`
writeFileSync(join(ROOT, 'docs/SYSTEM-WORKFLOW-MAP.html'), html)
console.log(
  `pages=${pages.length} hooks=${hooks.size} routes=${backendRoutes.length} unmatched=${unmatched.length}`,
)
