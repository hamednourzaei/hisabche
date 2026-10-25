import fs from 'node:fs'

const lines = fs.readFileSync('.claude/BUG-REGISTRY.md', 'utf8').split('\n')
const out = []
let current = ''
for (let i = 0; i < lines.length; i++) {
  const l = lines[i]
  if (l.startsWith('## ')) current = l.slice(3)
  if (/وضعیت:|Status:/.test(l)) {
    out.push(`${i + 1} | ${current.slice(0, 80)} | ${l.replace(/\*\*/g, '').slice(0, 160)}`)
  }
}
fs.writeFileSync('.agent-notes/agent-a/_bug-status.txt', out.join('\n'), 'utf8')
console.log('bugs', out.length)
