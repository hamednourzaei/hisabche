import fs from 'node:fs'

const files = ['docs/sales/hisabche-features-for-owners.md', 'docs/sales/hisabche-sales-script.md']
const banned = [
  'سرور',
  'دیتابیس',
  'پایگاه داده',
  'فرم‌ورک',
  'فریم‌ورک',
  'مایگریشن',
  'اسکیم',
  'کامپوننت',
  'دیپلوی',
  'بک‌اند',
  'فرانت‌اند',
  'سورس',
  'مخزن',
  'API',
  'SDK',
  'Electron',
  'React',
  'Next.js',
  'Supabase',
  'Fastify',
  'Postgres',
  'SQL',
  'JSON',
  'database',
  'schema',
  'endpoint',
  'repo',
  'backend',
  'server',
  'code',
]
let hits = 0
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    for (const w of banned) {
      const re = /^[A-Za-z]/.test(w)
        ? new RegExp(`(?<![A-Za-z])${w.replace(/\./g, '\\.')}(?![A-Za-z])`, 'i')
        : new RegExp(w)
      if (re.test(line)) {
        hits++
        console.log(`${f}:${i + 1} [${w}] ${line.slice(0, 100)}`)
      }
    }
  })
}
console.log(hits === 0 ? 'PASS: no banned technical words' : `FAIL: ${hits} hits`)
