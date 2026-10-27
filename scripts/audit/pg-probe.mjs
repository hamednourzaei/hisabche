// Read-only probe: can embedded-postgres initialise on this machine, and if not, why?
// Writes only inside .pgtest/tmp (the repository's own scratch area for this).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(path.join(process.cwd(), 'backend', 'package.json'))
const EmbeddedPostgres = require('embedded-postgres').default ?? require('embedded-postgres')
const root = path.join(process.cwd(), '.pgtest', 'tmp')
fs.mkdirSync(root, { recursive: true })
const dir = fs.mkdtempSync(path.join(root, 'probe-'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: 54999,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: (m) => console.log('[pg-log]', String(m).trim().slice(0, 300)),
  onError: (m) => console.log('[pg-err]', String(m).trim().slice(0, 300)),
})
const t0 = Date.now()
try {
  await pg.initialise()
  console.log('initialise OK in', Date.now() - t0, 'ms')
  await pg.start()
  console.log('start OK')
  await pg.createDatabase('probe')
  console.log('createDatabase OK')
} catch (e) {
  console.log('FAILED:', e && (e.message || e), '| code:', e && e.code)
} finally {
  try {
    await pg.stop()
  } catch (e) {
    console.log('stop failed:', e && e.message)
  }
}
