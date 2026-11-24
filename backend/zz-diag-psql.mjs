import fs from 'node:fs'
import net from 'node:net'
import { execFileSync } from 'node:child_process'
import EmbeddedPostgres from 'embedded-postgres'

const s = fs.readFileSync(
  'C:/Users/hamed/Desktop/hisabche/docs/service-delivery-05-session-subject-participants-migration.sql',
  'utf8',
)
const start = s.indexOf('CREATE OR REPLACE FUNCTION public.trg_sd_participant_delete()')
const end = s.indexOf('REVOKE EXECUTE ON FUNCTION public.trg_sd_participant_delete()')
const stmt = s.slice(start, end).trim()

const freePort = () =>
  new Promise((res) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port
      srv.close(() => res(p))
    })
  })
const PORT = await freePort()
const dir = 'C:/Users/hamed/AppData/Local/Temp/qwenwork/pgdiag-psql-' + Date.now()
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

const bin = 'C:/Users/hamed/AppData/Local/Temp/qwenwork/pgbin/bin'
const env = { ...process.env, PGPASSWORD: 'test', PGCLIENTENCODING: 'UTF8' }
const psql = (sqlText) => {
  try {
    const out = execFileSync(
      bin + '/psql.exe',
      [
        '-h',
        '127.0.0.1',
        '-p',
        String(PORT),
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        sqlText,
      ],
      { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return 'OK: ' + out.trim()
  } catch (e) {
    return 'FAIL: ' + (e.stderr || e.message)
  }
}
console.log(
  'setup:',
  psql(`CREATE TABLE public.service_delivery_sessions (id uuid PRIMARY KEY, subject_type text, customer_id uuid, employee_id uuid);
CREATE TABLE public.service_delivery_session_participants (id uuid PRIMARY KEY, session_id uuid, participant_type text, customer_id uuid, employee_id uuid, created_at timestamptz DEFAULT now());`),
)
console.log('psql -c full stmt:', psql(stmt))
// also via stdin file
fs.writeFileSync(dir + '/stmt.sql', stmt)
try {
  const out = execFileSync(
    bin + '/psql.exe',
    [
      '-h',
      '127.0.0.1',
      '-p',
      String(PORT),
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      dir + '/stmt.sql',
    ],
    { env, encoding: 'utf8' },
  )
  console.log('psql -f OK:', out.trim())
} catch (e) {
  console.log('psql -f FAIL:', e.stderr || e.message)
}
await pg.stop()
fs.rmSync(dir, { recursive: true, force: true })
