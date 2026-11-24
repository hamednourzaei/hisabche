import fs from 'node:fs'
import net from 'node:net'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'

const s = fs.readFileSync(
  'C:/Users/hamed/Desktop/hisabche/docs/service-delivery-05-session-subject-participants-migration.sql',
  'utf8',
)

// split into top-level statements using a Postgres-like lexer
const stmts = []
let i = 0,
  start = 0,
  state = 'code',
  depth = 0,
  tag = ''
while (i < s.length) {
  const two = s.slice(i, i + 2)
  if (state === 'code') {
    if (two === '--') {
      state = 'line'
      i += 2
      continue
    }
    if (two === '/*') {
      state = 'block'
      depth = 1
      i += 2
      continue
    }
    if (s[i] === "'") {
      state = 'str'
      i++
      continue
    }
    if (s[i] === '"') {
      state = 'ident'
      i++
      continue
    }
    if (s[i] === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(s.slice(i))
      if (m) {
        state = 'dollar'
        tag = m[0]
        i += tag.length
        continue
      }
    }
    if (s[i] === ';') {
      stmts.push(s.slice(start, i + 1))
      start = i + 1
    }
    i++
  } else if (state === 'line') {
    if (s[i] === '\n') state = 'code'
    i++
  } else if (state === 'block') {
    if (two === '/*') {
      depth++
      i += 2
      continue
    }
    if (two === '*/') {
      depth--
      if (!depth) state = 'code'
      i += 2
      continue
    }
    i++
  } else if (state === 'str') {
    if (s[i] === "'") {
      if (s[i + 1] === "'") {
        i += 2
        continue
      }
      state = 'code'
    }
    i++
  } else if (state === 'ident') {
    if (s[i] === '"') {
      if (s[i + 1] === '"') {
        i += 2
        continue
      }
      state = 'code'
    }
    i++
  } else if (state === 'dollar') {
    if (s.slice(i, i + tag.length) === tag) {
      state = 'code'
      i += tag.length
      continue
    }
    i++
  }
}
if (start < s.length) stmts.push(s.slice(start))
console.log('statements:', stmts.length, 'final lexer state:', state)

const freePort = () =>
  new Promise((res) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port
      srv.close(() => res(p))
    })
  })
const PORT = await freePort()
const dir = 'C:/Users/hamed/AppData/Local/Temp/qwenwork/pgdiag-sd05b-' + Date.now()
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
await pg.initialise()
await pg.start()
const admin = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
await admin`CREATE DATABASE sd05b;`
await admin.end()
const sql = postgres(`postgres://postgres:test@localhost:${PORT}/sd05b`, {
  max: 1,
  onnotice: () => {},
})
const doc = (n) => fs.readFileSync('C:/Users/hamed/Desktop/hisabche/docs/' + n, 'utf8')
const helper = fs.readFileSync(
  'C:/Users/hamed/Desktop/hisabche/backend/src/__tests__/helpers/service-delivery-05-scenarios.ts',
  'utf8',
)
const a = helper.indexOf('const STUB_SCHEMA = `') + 'const STUB_SCHEMA = `'.length
await sql.unsafe(helper.slice(a, helper.indexOf('`', a)))
for (const f of [
  'package-credit-ledger-01-migration.sql',
  'service-delivery-01-migration.sql',
  'service-delivery-02-atomic-migration.sql',
  'service-delivery-03-cancellation-reason-migration.sql',
  'service-delivery-04-settlement-undecided-migration.sql',
]) {
  await sql.unsafe(doc(f))
}
for (const [idx, st] of stmts.entries()) {
  const trimmed = st.trim()
  if (!trimmed || /^(--[^\n]*\n?)+$/.test(trimmed)) continue
  try {
    await sql.unsafe(st)
  } catch (e) {
    console.log('FAIL stmt #' + idx, '|', e.message, '| pos:', e.position)
    console.log('STMT HEAD:', JSON.stringify(trimmed.slice(0, 160)))
    console.log('STMT TAIL:', JSON.stringify(trimmed.slice(-160)))
    break
  }
}
console.log('done')
await sql.end({ timeout: 5 })
await pg.stop()
fs.rmSync(dir, { recursive: true, force: true })
