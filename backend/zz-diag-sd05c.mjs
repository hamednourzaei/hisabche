import fs from 'node:fs'
import net from 'node:net'
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'

const s = fs.readFileSync(
  'C:/Users/hamed/Desktop/hisabche/docs/service-delivery-05-session-subject-participants-migration.sql',
  'utf8',
)
const start = s.indexOf('CREATE OR REPLACE FUNCTION public.trg_sd_participant_delete()')
const end = s.indexOf('REVOKE EXECUTE ON FUNCTION public.trg_sd_participant_delete()')
const stmt = s.slice(start, end).trim()
console.log('STMT LEN:', stmt.length)
console.log('STMT TAIL:', JSON.stringify(stmt.slice(-120)))

const freePort = () =>
  new Promise((res) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port
      srv.close(() => res(p))
    })
  })
const PORT = await freePort()
const dir = 'C:/Users/hamed/AppData/Local/Temp/qwenwork/pgdiag-sd05c-' + Date.now()
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
const sql = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`, {
  max: 1,
  onnotice: () => {},
})

// minimal tables the function references
await sql.unsafe(`
CREATE TABLE public.service_delivery_sessions (id uuid PRIMARY KEY, subject_type text, customer_id uuid, employee_id uuid);
CREATE TABLE public.service_delivery_session_participants (id uuid PRIMARY KEY, session_id uuid, participant_type text, customer_id uuid, employee_id uuid, created_at timestamptz DEFAULT now());
`)
try {
  await sql.unsafe(stmt)
  console.log('FUNCTION OK standalone')
} catch (e) {
  console.log('FUNCTION FAIL standalone:', e.message, 'pos:', e.position, 'routine:', e.routine)
  // bisect: try with body replaced by trivial
  const trivial = stmt.replace(/AS \$\$[\s\S]*END \$\$;/, () => 'AS $$ BEGIN RETURN OLD; END $$;')
  try {
    await sql.unsafe(trivial)
    console.log('TRIVIAL BODY OK -> problem inside body')
  } catch (e2) {
    console.log('TRIVIAL BODY FAIL:', e2.message)
  }
}
await sql.end({ timeout: 5 })
await pg.stop()
fs.rmSync(dir, { recursive: true, force: true })
