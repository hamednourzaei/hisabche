import fs from 'node:fs'

const files = ['docs/sales/hisabche-features-for-owners.md', 'docs/sales/hisabche-sales-script.md']
let problems = 0
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  const lines = text.split(/\r?\n/)

  // Persian typography issues: Arabic ي / ك instead of Persian ی / ک, and straight "?" / ";" inside Persian text
  lines.forEach((line, i) => {
    if (/[\u064A\u0643]/.test(line)) {
      problems++
      console.log(`TYPO ${f}:${i + 1} arabic yeh/kaf: ${line.slice(0, 80)}`)
    }
    if (/[a-zA-Z]+[\u0600-\u06FF]|[\u0600-\u06FF][a-zA-Z]+/.test(line) && !/`/.test(line)) {
      // glued latin+persian (ignoring backticked code)
      problems++
      console.log(`SPACING ${f}:${i + 1} latin/persian glued: ${line.slice(0, 80)}`)
    }
  })

  // long sentences (> 25 words) signalling overlong spoken lines
  const sentences = text
    .replace(/```[\s\S]*?```/g, '')
    .split(/[.!؟?]\s|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const tooLong = sentences.filter((s) => s.split(/\s+/).length > 34)
  console.log(`${f}: sentences=${sentences.length} over34words=${tooLong.length}`)
  tooLong.slice(0, 5).forEach((s) => console.log('   LONG: ' + s.slice(0, 120)))
}
console.log(problems === 0 ? 'PASS: typography' : `FAIL: ${problems} typography issues`)
