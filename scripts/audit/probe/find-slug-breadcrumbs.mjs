// Finds page routes whose breadcrumb would print the raw URL slug.
//
// `Breadcrumb` (packages/ui/src/components/ui/breadcrumb.tsx) derives the trail
// from NAV_CONTRACT. A route that is NOT in the contract falls back to
// `crumbs.<segment>`, and when that key is missing too, to the segment itself —
// so `/en/sync-center` showed the crumb «sync-center».
//
// Usage: node scripts/audit/probe/find-slug-breadcrumbs.mjs [locale]
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALE = process.argv[2] || 'en'
const ROUTES = path.join(ROOT, 'apps', 'web', 'app', '[lang]', '(dashboard)')
const NAV = path.join(ROOT, 'packages', 'ui-contract', 'src', 'navigation.ts')
const BUNDLE = path.join(ROOT, 'packages', 'i18n', 'messages', LOCALE, 'common.json')

const navSource = fs.readFileSync(NAV, 'utf8')
const contractPaths = new Set(
  [...navSource.matchAll(/^\s*path:\s*'([^']+)'/gm)].map((m) => m[1].replace(/\/$/, '')),
)

const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'))
const crumbKeys = new Set(Object.keys(bundle.crumbs || {}))

const segments = fs
  .readdirSync(ROUTES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('('))
  .map((entry) => entry.name)

const broken = []
for (const segment of segments) {
  if (contractPaths.has('/' + segment)) continue
  if (crumbKeys.has(segment)) continue
  broken.push(segment)
}

console.log(`locale: ${LOCALE}`)
console.log(`dashboard route folders: ${segments.length}`)
console.log(`NAV_CONTRACT paths: ${contractPaths.size}`)
console.log(`crumbs keys in bundle: ${crumbKeys.size}`)
console.log(`routes that would print a raw slug: ${broken.length}`)
for (const segment of broken) console.log('  /' + segment)
