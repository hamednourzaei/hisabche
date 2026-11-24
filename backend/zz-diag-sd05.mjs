// TEMP diagnostic: run each setup file, report exact error position.
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import fs from 'node:fs'
import net from 'node:net'

const freePort = () =>
  new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
const PORT = await freePort()
const dir = 'C:/Users/hamed/AppData/Local/Temp/qwenwork/pgdiag-sd05-' + Date.now()
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
await admin`CREATE DATABASE sd05diag;`
await admin.end()
const sql = postgres(`postgres://postgres:test@localhost:${PORT}/sd05diag`, {
  max: 1,
  onnotice: () => {},
})
const doc = (n) => fs.readFileSync('C:/Users/hamed/Desktop/hisabche/docs/' + n, 'utf8')

// use the REAL stub from the scenario helper so nothing unrelated fails
const helper = fs.readFileSync(
  'C:/Users/hamed/Desktop/hisabche/backend/src/__tests__/helpers/service-delivery-05-scenarios.ts',
  'utf8',
)
const stubStart = helper.indexOf('const STUB_SCHEMA = `') + 'const STUB_SCHEMA = `'.length
const stubEnd = helper.indexOf('`', stubStart)
const STUB_SCHEMA = helper.slice(stubStart, stubEnd)
await sql.unsafe(STUB_SCHEMA)

const files = [
  'package-credit-ledger-01-migration.sql',
  'service-delivery-01-migration.sql',
  'service-delivery-02-atomic-migration.sql',
  'service-delivery-03-cancellation-reason-migration.sql',
  'service-delivery-04-settlement-undecided-migration.sql',
  'service-delivery-05-session-subject-participants-migration.sql',
]
for (const f of files) {
  const text = doc(f)
  try {
    await sql.unsafe(text)
    console.log('OK  ', f)
  } catch (e) {
    console.log('FAIL', f, '|', e.message, '| position:', e.position)
    console.log(
      'severity:',
      e.severity,
      'routine:',
      e.routine,
      'file:',
      e.file,
      'line:',
      e.line,
      'where:',
      e.where,
    )
    if (e.position) {
      const p = Number(e.position)
      console.log('CONTEXT:', JSON.stringify(text.slice(Math.max(0, p - 200), p + 120)))
    }
    break
  }
}
await sql.end({ timeout: 5 })
await pg.stop()
fs.rmSync(dir, { recursive: true, force: true })
