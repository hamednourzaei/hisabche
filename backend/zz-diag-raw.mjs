import fs from 'node:fs'
import net from 'node:net'
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
const dir = 'C:/Users/hamed/AppData/Local/Temp/qwenwork/pgdiag-raw-' + Date.now()
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

// raw simple-query protocol client
function rawQuery(queryText) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, '127.0.0.1')
    let buf = Buffer.alloc(0)
    let phase = 'startup'
    const results = []
    sock.on('connect', () => {
      // startup message: user=postgres database=postgres
      const params = Buffer.from('user\0postgres\0database\0postgres\0\0')
      const len = 4 + 4 + params.length
      const m = Buffer.alloc(len)
      m.writeInt32BE(len, 0)
      m.writeInt32BE(196608, 4)
      params.copy(m, 8)
      sock.write(m)
    })
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d])
      while (buf.length >= 5) {
        const type = String.fromCharCode(buf[0])
        const len = buf.readInt32BE(1)
        if (buf.length < 1 + len) break
        const body = buf.slice(5, 1 + len)
        buf = buf.slice(1 + len)
        if (type === 'R') {
          const authType = body.readInt32BE(0)
          if (authType === 0 && phase === 'startup') {
            phase = 'ready-wait'
          } else if (authType === 3) {
            sock.write(
              Buffer.concat([
                Buffer.from('p'),
                (() => {
                  const b = Buffer.alloc(4 + 5 + 1)
                  b.writeInt32BE(4 + 5 + 1, 0)
                  b.write('test\0', 4)
                  return b
                })(),
              ]),
            )
          }
        } else if (type === 'Z') {
          if (phase === 'ready-wait') {
            phase = 'query'
            const qb = Buffer.from(queryText + '\0')
            const qm = Buffer.alloc(1 + 4 + qb.length)
            qm.write('Q', 0)
            qm.writeInt32BE(4 + qb.length, 1)
            qb.copy(qm, 5)
            sock.write(qm)
          } else {
            sock.end()
            resolve(results)
          }
        } else if (type === 'E') {
          results.push('ERROR: ' + body.toString('utf8').replace(/\0/g, ' | '))
        } else if (type === 'C') {
          results.push('CMD: ' + body.toString('utf8').replace(/\0/g, ''))
        } else if (type === 'N') {
          // notice, ignore
        }
      }
    })
    sock.on('error', reject)
    setTimeout(() => {
      sock.destroy()
      reject(new Error('timeout'))
    }, 15000)
  })
}

console.log(
  'setup:',
  (
    await rawQuery(
      `CREATE TABLE public.service_delivery_sessions (id uuid PRIMARY KEY, subject_type text, customer_id uuid, employee_id uuid); CREATE TABLE public.service_delivery_session_participants (id uuid PRIMARY KEY, session_id uuid, participant_type text, customer_id uuid, employee_id uuid, created_at timestamptz DEFAULT now());`,
    )
  ).join(' ;; '),
)
console.log('RAW full stmt:', (await rawQuery(stmt)).join(' ;; '))
await pg.stop()
fs.rmSync(dir, { recursive: true, force: true })
