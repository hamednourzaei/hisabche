import fs from 'node:fs'
import path from 'node:path'

const roots = ['packages/ui/src', 'apps/web/app', 'packages/app-shell/src']
const re = /TODO|FIXME|coming soon|به‌زودی|به زودی|ComingSoon/i
const hits = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.next') walk(p)
    } else if (/\.(tsx?|json)$/.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8')
      const lines = t.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) hits.push(`${p}:${i + 1}: ${lines[i].trim().slice(0, 140)}`)
      }
    }
  }
}
for (const r of roots) if (fs.existsSync(r)) walk(r)
fs.writeFileSync('.agent-notes/agent-a/_todo-scan.txt', hits.join('\n'), 'utf8')
console.log('hits', hits.length)
