// Read-only scan: for every web page, find what it renders and what that
// component does. Writes one JSON file the page documents are generated from.
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const WEB = path.join(ROOT, 'apps/web/app')
const UI = path.join(ROOT, 'packages/ui/src')
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      walk(full, out)
    } else out.push(full)
  }
  return out
}
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')

// ── where each exported UI component lives ──
const uiFiles = walk(UI).filter((f) => /\.tsx?$/.test(f))
const exportedIn = new Map()
for (const file of uiFiles) {
  const src = read(file)
  for (const m of src.matchAll(
    /export (?:default )?(?:async )?function (\w+)|export const (\w+)\s*=/g,
  )) {
    const name = m[1] || m[2]
    if (name && !exportedIn.has(name)) exportedIn.set(name, file)
  }
}

// ── navigation contract ──
const nav = read(path.join(ROOT, 'packages/ui-contract/src/navigation.ts'))
const navItems = []
for (const m of nav.matchAll(/\bid: '([\w-]+)',[\s\S]*?path: '([^']+)'/g)) {
  navItems.push({ id: m[1], path: m[2] })
}
const moduleOf = {}
for (const m of nav.matchAll(/'(\/[\w\-/]*)': '([\w-]+)',/g)) moduleOf[m[1]] = m[2]
const sidebar = read(path.join(ROOT, 'packages/app-shell/src/components/layout/sidebar.tsx'))
const shell = read(path.join(ROOT, 'packages/app-shell/src/app/app.tsx'))
const docsMap = read(path.join(UI, 'components/ui/docs/docs-help-link.tsx'))
const robots = read(path.join(ROOT, 'apps/web/app/robots.ts'))

const pages = walk(WEB).filter((f) => path.basename(f) === 'page.tsx')
const result = []

function localImports(file, src) {
  const out = []
  for (const m of src.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const base = path.resolve(path.dirname(file), m[1])
    for (const candidate of [
      base + '.tsx',
      base + '.ts',
      path.join(base, 'index.tsx'),
      path.join(base, 'index.ts'),
    ]) {
      if (fs.existsSync(candidate)) {
        out.push(candidate)
        break
      }
    }
  }
  return out
}

/** The container file plus the component files it pulls in from its own area (two levels). */
function componentTree(entry) {
  const seen = new Set([entry])
  let frontier = [entry]
  for (let depth = 0; depth < 2; depth++) {
    const next = []
    for (const file of frontier) {
      for (const imported of localImports(file, read(file))) {
        if (seen.has(imported)) continue
        if (!imported.includes(path.join('components', 'ui'))) continue
        // Shared primitives are not part of a page's own surface.
        if (path.dirname(imported) === path.join(UI, 'components', 'ui')) continue
        seen.add(imported)
        next.push(imported)
      }
    }
    frontier = next
  }
  return [...seen]
}

for (const page of pages) {
  const src = read(page)
  const segs = rel(page).replace('apps/web/app/', '').replace('/page.tsx', '').split('/')
  const dashboard = segs.includes('(dashboard)')
  const route = '/' + segs.filter((s) => s !== '[lang]' && !s.startsWith('(')).join('/')
  const cleanRoute = route === '/' ? '/' : route.replace(/\/$/, '')

  const containers = [...src.matchAll(/<([A-Z]\w+)[\s/>]/g)]
    .map((m) => m[1])
    .filter(
      (name) =>
        exportedIn.has(name) &&
        /Container|Page|View|Screen|Landing|Workspace|Form|Center|Hub/.test(name),
    )
  const container = containers[0] || null
  const containerFile = container ? exportedIn.get(container) : null
  const files = containerFile ? componentTree(containerFile) : []
  const all = files.map(read).join('\n')

  const hooks = [...new Set([...all.matchAll(/\b(use[A-Z]\w+)\b/g)].map((m) => m[1]))].filter(
    (h) =>
      !/^use(State|Effect|Memo|Callback|Ref|Translations|Locale|Router|Params|Pathname|SearchParams|Id|Context|Reducer|LayoutEffect|Transition|DeferredValue|SyncExternalStore|ImperativeHandle|IntlLocale|DateFormat|LocalePush|LocaleReplace|RouteLang|QueryClient|Query|Mutation|Form|Debounce\w*|Media\w*|IsMobile|Toast)$/.test(
        h,
      ),
  )
  const queries = hooks.filter(
    (h) =>
      !/^use(Create|Save|Update|Delete|Set|Mark|Record|Assign|Cancel|Retire|Launch|Assess|Confirm|Add|Remove|Send|Approve|Reject|Run|Import|Upload|Post|Translate|Read|Ask|Toggle|Complete|Close|Open|Reset|Rotate|Revoke|Install|Publish|Transfer|Pay|Refund|Move|Convert|Merge|Restore|Resolve|Invite|Accept|Start|Stop|Submit|Generate|Apply|Clear|Plan|Receive|Issue)/.test(
        h,
      ),
  )
  const mutations = hooks.filter((h) => !queries.includes(h))

  const tabs = [
    ...new Set([...all.matchAll(/<TabsTrigger[^>]*value=\{?['"]([\w-]+)['"]/g)].map((m) => m[1])),
  ]
  const sectionIds = [...new Set([...all.matchAll(/\{ id: '([\w-]+)', label:/g)].map((m) => m[1]))]
  const dialogs = (all.match(/<(Dialog|Modal|Sheet|Drawer|AlertDialog)\b/g) || []).length
  const forms = (all.match(/<form\b|<input\b|<textarea\b|SelectField\b/g) || []).length
  const tables = (all.match(/<table\b|DataTable\b|<Table\b/g) || []).length
  const links = [
    ...new Set(
      [
        ...all.matchAll(
          /(?:push|replace|localizePath)\(\s*[`'"](\/[\w\-/]*)|href=\{?[`'"](\/[\w\-/]+)/g,
        ),
      ]
        .map((m) => (m[1] || m[2] || '').replace(/\/$/, ''))
        .filter(Boolean),
    ),
  ]

  const first = '/' + (cleanRoute.split('/')[1] || '')
  const navItem = navItems.find((item) => item.path === cleanRoute) || null
  const titleKey =
    (src.match(/title:\s*t\(\s*['"]([\w.]+)['"]/) ||
      src.match(/getTranslations\([^)]*\)[\s\S]{0,200}?t\(['"]([\w.]+)['"]/) ||
      [])[1] || null

  result.push({
    route: cleanRoute,
    pageFile: rel(page),
    area: dashboard ? 'app' : 'public',
    dynamic: /\[/.test(cleanRoute),
    titleKey,
    container,
    containerFile: containerFile ? rel(containerFile) : null,
    files: files.map((f) => ({ file: rel(f), lines: read(f).split('\n').length })),
    totalLines: files.reduce((sum, f) => sum + read(f).split('\n').length, 0),
    queries,
    mutations,
    tabs: tabs.length ? tabs : sectionIds,
    dialogs,
    formControls: forms,
    tables,
    linksTo: links.filter((l) => l !== cleanRoute),
    nav: navItem ? navItem.id : null,
    module: moduleOf[first] || null,
    inSidebar: sidebar.includes("'" + first + "'"),
    inAppShell: dashboard
      ? new RegExp(
          "path: '" +
            cleanRoute
              .slice(1)
              .replace(/\[(\w+)\]/g, ':$1')
              .replace(/[/]/g, '\\/') +
            "'",
        ).test(shell)
      : null,
    docsArticle:
      (docsMap.match(
        new RegExp('[\'"]?' + first.slice(1).replace(/-/g, '[-]') + "['\"]?: '([\\w-]+)'"),
      ) || [])[1] || null,
    robotsBlocked: dashboard ? robots.includes("'/*" + first + "'") : null,
    states: {
      loading: /isLoading|isPending|Skeleton|animate-pulse/.test(all),
      error: /role="alert"|\.error\b|isError/.test(all),
      empty: /empty|Empty|length === 0/.test(all),
      forbidden: /403|forbidden/.test(all),
      notSetUp: /MIGRATION_PENDING|NOT_CONFIGURED|notConfigured/.test(all),
    },
  })
}

// Who links to each route.
for (const page of result) {
  page.linkedFrom = result
    .filter(
      (other) =>
        other !== page &&
        other.linksTo.some(
          (l) =>
            l === page.route || (page.dynamic && l.startsWith(page.route.split('/[')[0] + '/')),
        ),
    )
    .map((o) => o.route)
}
result.sort((a, b) => a.route.localeCompare(b.route))
fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2))
const app = result.filter((p) => p.area === 'app')
console.log(
  'pages',
  result.length,
  'app',
  app.length,
  'no container',
  result
    .filter((p) => !p.container)
    .map((p) => p.route)
    .join(' '),
)
for (const p of app) {
  console.log(
    [
      p.route.padEnd(28),
      (p.module || '-').padEnd(11),
      p.nav ? 'nav' : '   ',
      String(p.totalLines).padStart(5),
      'q' + p.queries.length,
      'm' + p.mutations.length,
      't[' + p.tabs.join(',') + ']',
      '->' + p.linksTo.slice(0, 6).join(','),
    ].join(' '),
  )
}
