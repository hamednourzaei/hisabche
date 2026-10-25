// The runtime audit of every registered reel: id, plan id, actual timeline duration, verdict.
// Usage:  node scripts/runtime-audit.mjs            (prints a summary and the failing reels)
//         node scripts/runtime-audit.mjs --write    (also rewrites the table in docs/RUNTIME-AUDIT.md)
//
// The duration is read from the reel's own scenes (the end of the last one) — never from the file
// name or the reel id. `reel.duration` is compared with it; a disagreement is reported.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { MIN_RUNTIME_SECONDS, RUNTIME_REMEDIATION, judgeRuntime } from './runtime-law.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The plan id each reel answers to, read from docs/100-VIDEO-PLAN.md-linked prompt files. */
function planIds() {
  const map = new Map()
  const dir = path.join(ROOT, 'docs', 'prompts')
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const reel = /^reel-(\d+)-prompt\.md$/.exec(name)
    if (!reel) continue
    const text = fs.readFileSync(path.join(dir, name), 'utf8')
    const plan = /\b(L[0-4]\.\d{2})\b/.exec(text)
    if (plan) map.set(String(reel[1]).padStart(2, '0'), plan[1])
  }
  return map
}

export async function auditRuntime() {
  const server = await createServer({
    root: ROOT,
    server: { middlewareMode: true, hmr: false, watch: null },
    logLevel: 'error',
  })
  try {
    const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
    const plans = planIds()
    return REELS.map((reel) => {
      const verdict = judgeRuntime(reel)
      return {
        id: String(reel.id).padStart(2, '0'),
        plan: plans.get(String(reel.id).padStart(2, '0')) ?? '—',
        title: reel.title,
        declared: reel.duration,
        seconds: verdict.seconds,
        status: verdict.status,
        scenes: reel.scenes.length,
      }
    })
  } finally {
    await server.close()
  }
}

export function renderTable(rows) {
  const head =
    '| Reel | Plan | Seconds | Verdict | Scenes | Title |\n| --- | --- | ---: | --- | ---: | --- |'
  const body = rows
    .map(
      (r) =>
        `| ${r.id} | ${r.plan} | ${r.seconds.toFixed(1)} | ${r.status} | ${r.scenes} | ${r.title} |`,
    )
    .join('\n')
  return `${head}\n${body}`
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const rows = await auditRuntime()
  const failing = rows.filter((r) => r.status !== 'ok')
  console.log(
    `${rows.length} reels · minimum > ${MIN_RUNTIME_SECONDS}s · passing ${rows.length - failing.length} · not passing ${failing.length}`,
  )
  console.log(`recorded remediation list: [${RUNTIME_REMEDIATION.join(', ')}]`)
  for (const r of failing)
    console.log(
      `  ${r.status.padEnd(12)} reel ${r.id} (${r.plan}) ${r.seconds.toFixed(1)}s  ${r.title}`,
    )
  if (process.argv.includes('--write')) {
    const file = path.join(ROOT, 'docs', 'RUNTIME-AUDIT.md')
    const text = fs.readFileSync(file, 'utf8')
    const begin = '<!-- AUDIT:BEGIN -->'
    const end = '<!-- AUDIT:END -->'
    const from = text.indexOf(begin)
    const to = text.indexOf(end)
    if (from < 0 || to < from) throw new Error('docs/RUNTIME-AUDIT.md has no AUDIT markers')
    const table = renderTable(rows)
    fs.writeFileSync(file, `${text.slice(0, from + begin.length)}\n${table}\n${text.slice(to)}`)
    console.log(`table written inside ${file}`)
  }
}
