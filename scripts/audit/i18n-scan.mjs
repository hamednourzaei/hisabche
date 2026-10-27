// Read-only i18n / RTL / formatting scan over the shared UI and the three app shells.
// Heuristics (stated in the output): a "literal" is Persian text that is not inside a comment, not a fallback argument
// of t()/translateOr(), not in a test. JSX text and attribute literals are what a user would see without a catalogue.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'build'].includes(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (/\.(tsx|ts)$/.test(e.name) && !/__tests__|\.test\./.test(p)) o.push(p)
  }
  return o
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')
const FA = /[؀-ۿ]/
const files = [
  ...walk(path.join(ROOT, 'packages/ui/src')),
  ...walk(path.join(ROOT, 'packages/app-shell/src')),
  ...walk(path.join(ROOT, 'apps/web/app')),
  ...walk(path.join(ROOT, 'apps/admin')),
]
const res = {
  jsxText: {},
  attr: {},
  fallbackOnly: 0,
  other: 0,
  physical: {},
  rawLocale: {},
  hardLocaleCode: {},
  englishJsx: {},
}
const bump = (o, k) => (o[k] = (o[k] || 0) + 1)
for (const f of files) {
  const r = rel(f)
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  let inBlock = false
  lines.forEach((ln) => {
    const t = ln.trim()
    if (inBlock) {
      if (t.includes('*/')) inBlock = false
      return
    }
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true
      return
    }
    if (t.startsWith('//') || t.startsWith('*')) return
    const code = ln.replace(/\/\/.*$/, '')
    if (FA.test(code)) {
      const isFallback =
        /(?:\bt|translateOr|translate|tr)\([^)]*(?:fallback|,\s*['"`])/.test(code) ||
        /fallback\s*:/.test(code)
      const jsxText =
        /(^|>)\s*[^<>{}=]*[؀-ۿ][^<>{}]*(<|$)/.test(code) &&
        !/^\s*(import|export|const|let|var|type|interface|case|return\s*\()/.test(t) &&
        !/['"`][^'"`]*[؀-ۿ]/.test(code.replace(/>[^<]*</g, ''))
      const attr =
        /\b(placeholder|title|aria-label|label|alt|description|helperText)\s*=\s*["'{`][^"'`]*[؀-ۿ]/.test(
          code,
        )
      if (attr && !isFallback) bump(res.attr, r)
      else if (jsxText && !isFallback) bump(res.jsxText, r)
      else if (isFallback) res.fallbackOnly++
      else res.other++
    }
    if (
      /\b(ml|mr|pl|pr)-(\d|\[|px|auto)/.test(code) ||
      /\b(?<![-\w])(left|right)-(\d|\[|0|full|1\/2)/.test(code) ||
      /\btext-(left|right)\b/.test(code) ||
      /\bborder-(l|r)(-|\b)/.test(code) ||
      /\brounded-(l|r)(-|\b)/.test(code)
    )
      bump(res.physical, r)
    if (
      /toLocaleString\(|toLocaleDateString\(|toLocaleTimeString\(|new Intl\.(NumberFormat|DateTimeFormat)\(/.test(
        code,
      )
    )
      bump(res.rawLocale, r)
    if (/['"`](fa-IR|fa-AF|en-US|en-GB)['"`]/.test(code)) bump(res.hardLocaleCode, r)
    if (/>\s*[A-Z][a-z]{3,}(\s+[A-Za-z]+)*\s*</.test(code) && !/\bt\(/.test(code))
      bump(res.englishJsx, r)
  })
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
const top = (o, n = 12) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
const out = {
  filesScanned: files.length,
  persianJsxTextLines: sum(res.jsxText),
  persianJsxTextFiles: Object.keys(res.jsxText).length,
  persianAttrLines: sum(res.attr),
  persianAttrFiles: Object.keys(res.attr).length,
  persianFallbackLines: res.fallbackOnly,
  persianOtherLines: res.other,
  physicalDirectionLines: sum(res.physical),
  physicalDirectionFiles: Object.keys(res.physical).length,
  rawLocaleCallLines: sum(res.rawLocale),
  rawLocaleFiles: Object.keys(res.rawLocale).length,
  hardcodedLocaleCodeLines: sum(res.hardLocaleCode),
  englishJsxLines: sum(res.englishJsx),
}
fs.writeFileSync(
  path.join(ROOT, 'docs/audit/generated/i18n-scan.json'),
  JSON.stringify(
    {
      out,
      jsxText: res.jsxText,
      attr: res.attr,
      physical: res.physical,
      rawLocale: res.rawLocale,
      hardLocale: res.hardLocaleCode,
      englishJsx: res.englishJsx,
    },
    null,
    1,
  ),
)
console.log(JSON.stringify(out, null, 1))
console.log('top JSX-text files:', top(res.jsxText))
console.log('top attr files:', top(res.attr))
console.log('top physical-direction files:', top(res.physical))
console.log('top raw-locale files:', top(res.rawLocale))
console.log('hard locale codes:', top(res.hardLocaleCode, 8))
console.log('english jsx:', top(res.englishJsx, 8))
