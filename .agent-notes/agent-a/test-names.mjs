import fs from 'node:fs'
import path from 'node:path'

const roots = ['backend/src', 'packages/ui/src', 'packages/api/src', 'packages/validation/src']
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') walk(p)
    } else if (/\.test\.tsx?$/.test(e.name)) files.push(p)
  }
}
for (const r of roots) if (fs.existsSync(r)) walk(r)

const names = []
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  for (const m of t.matchAll(/^\s*(?:it|test)\(\s*['"`]([^'"`]{3,120})/gm)) {
    names.push(`${f} :: ${m[1]}`)
  }
}
fs.writeFileSync('.agent-notes/agent-a/_test-names.txt', names.join('\n'), 'utf8')
console.log('files', files.length, 'tests', names.length)
