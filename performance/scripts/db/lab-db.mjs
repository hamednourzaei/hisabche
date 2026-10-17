#!/usr/bin/env node
// ============================================================================
// performance/scripts/db/lab-db.mjs
//
// The capacity lab's own PostgreSQL 17.10 — REAL Postgres binaries that
// already exist in this repository (`embedded-postgres` is a backend
// devDependency; the `*.pg.test.ts` suites use it), managed here as a
// long-lived local server instead of a per-test temp cluster.
//
// ---------------------------------------------------------------------------
// WHY postgres.exe DIRECTLY AND NOT pg_ctl
//
// This distribution is minimal: its bin/ carries `initdb`, `pg_ctl` and
// `postgres` — and nothing else. `pg_ctl` shells out to `pg_controldata` to
// read the cluster state; that binary is not shipped, so `pg_ctl start`
// reports the misleading `control file appears to be corrupt` and refuses to
// run. (Measured, not guessed — see status/M1.md.)
//
// So the lab spawns `postgres.exe` itself, detached, with stdout/stderr
// appended to a log file, and finds its PID later in `postmaster.pid`. Stop
// runs `CHECKPOINT` first so the hard kill that Windows offers costs almost
// no recovery — the same shutdown shape the repository's own pg test suites
// live with.
//
// COMMANDS
//   init      create the cluster (initdb), TLS cert, lab settings — once
//   start     start the server (detached), wait until it answers, ensure DB
//   stop      CHECKPOINT + terminate the postmaster tree
//   status    is it running, and is it answering
//   sql-file  run a .sql file against the lab database (multi-statement)
//   sql       run one SQL string (lab database)
//
// Every command refuses a non-loopback target (lib/lab-config.mjs).
// ============================================================================

import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

import { LAB, LAB_URL, ADMIN_URL, assertLocal } from '../lib/lab-config.mjs'
import { embeddedPostgresClass, postgresBinaries } from '../lib/deps.mjs'
import pg from 'pg'

const { Client } = pg

const command = process.argv[2]
const arg = process.argv[3]

const SETTINGS_MARKER = '# ─── hisabche capacity lab (performance/scripts/db/lab-db.mjs) ───'

/** Git for Windows ships OpenSSL; the lab uses it for a loopback-only cert. */
const OPENSSL = 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function settingsBlock() {
  const lines = Object.entries(LAB.postgresSettings).map(([key, value]) => `${key} = ${value}`)
  return (
    `\n${SETTINGS_MARKER}\nport = ${LAB.port}\n${lines.join('\n')}\n` +
    // TLS: the repository's migration runner connects with `ssl` forced on,
    // and Supabase production requires TLS — so the lab server speaks TLS too.
    `ssl = on\nssl_cert_file = 'server.crt'\nssl_key_file = 'server.key'\n`
  )
}

async function connect(url, applicationName) {
  const client = new Client({
    connectionString: assertLocal(url),
    application_name: applicationName,
  })
  await client.connect()
  return client
}

async function probe(url, applicationName) {
  try {
    const client = await connect(url, applicationName)
    await client.query('SELECT 1')
    await client.end()
    return true
  } catch {
    return false
  }
}

/**
 * Is the SERVER up? Probes the maintenance database, which always exists —
 * the lab database may not have been created yet (initial start), and a
 * readiness check against a missing database reads as "server down".
 */
const serverAnswering = () => probe(ADMIN_URL, 'lab-db:ping-admin')

/** Is the lab database itself reachable (server up AND database created)? */
const isAnswering = () => probe(LAB_URL, 'lab-db:ping')

function readPostmasterPid() {
  const pidFile = join(LAB.dataDir, 'postmaster.pid')
  if (!existsSync(pidFile)) return null
  const pid = Number(readFileSync(pidFile, 'utf8').split('\n')[0].trim())
  return Number.isInteger(pid) && pid > 0 ? pid : null
}

/**
 * Refuse to spawn a postgres whose major version differs from the data
 * directory's. This is not defensive coding — it is the exact failure that
 * cost a debugging round in M1: a stray v18 binary was spawned against a v17
 * cluster and the only trace was `database files are incompatible with
 * server` in the log.
 */
function assertServerMatchesCluster(postgresExe) {
  const clusterMajor = readFileSync(join(LAB.dataDir, 'PG_VERSION'), 'utf8').trim().split('.')[0]
  const version = spawnSync(postgresExe, ['--version'], { encoding: 'utf8' })
  const match = /PostgreSQL\)\s+(\d+)/.exec(version.stdout ?? '')
  if (!match) {
    throw new Error(`could not read the version of ${postgresExe}: "${version.stdout}"`)
  }
  if (match[1] !== clusterMajor) {
    throw new Error(
      `binary/data-directory version mismatch: ${postgresExe} is v${match[1]} but the cluster is v${clusterMajor}.\n` +
        'The lab pins the platform package through embedded-postgres (performance/scripts/lib/deps.mjs); ' +
        'if this fires, something resolved a different @embedded-postgres/windows-x64.',
    )
  }
  return { serverMajor: match[1] }
}

async function init() {
  if (existsSync(join(LAB.dataDir, 'PG_VERSION'))) {
    console.log(`already initialised: ${LAB.dataDir}`)
    return
  }
  mkdirSync(dirname(LAB.dataDir), { recursive: true })

  const EmbeddedPostgres = await embeddedPostgresClass()
  const pgCluster = new EmbeddedPostgres({
    databaseDir: LAB.dataDir,
    port: LAB.port,
    user: LAB.user,
    password: LAB.password,
    persistent: true, // never let stop() delete the cluster
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {}, // initdb chatter is not interesting when it succeeds
  })

  console.log(`initdb → ${LAB.dataDir}`)
  await pgCluster.initialise()

  generateCertificate()
  appendFileSync(join(LAB.dataDir, 'postgresql.conf'), settingsBlock())
  console.log(
    `postgresql.conf: lab settings appended (port ${LAB.port}, TLS on, pg_stat_statements preloaded)`,
  )
  console.log('initialised — next: lab-db.mjs start')
}

/**
 * A self-signed certificate for localhost, valid for 10 years. Loopback only:
 * the CN and SAN name nothing but this machine.
 */
function generateCertificate() {
  const result = spawnSync(
    OPENSSL,
    [
      'req',
      '-new',
      '-x509',
      '-days',
      '3650',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-keyout',
      join(LAB.dataDir, 'server.key'),
      '-out',
      join(LAB.dataDir, 'server.crt'),
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(
      `openssl failed (${result.status}). The repo's migration runner forces SSL, ` +
        `so the lab server needs a certificate. Install Git for Windows (which ships openssl) ` +
        `or point OPENSSL in lab-db.mjs at another one.\n${result.stderr}`,
    )
  }
  console.log('self-signed TLS certificate generated (localhost only)')
}

async function start() {
  if (await serverAnswering()) {
    console.log('already running')
  } else {
    const { postgres } = await postgresBinaries()
    const { serverMajor } = assertServerMatchesCluster(postgres)
    const logFd = openSync(LAB.logFile, 'a')
    const child = spawn(postgres, ['-D', LAB.dataDir], {
      detached: true,
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
    })
    child.unref()
    console.log(
      `postgres v${serverMajor} spawned detached (pid ${child.pid}); waiting for readiness…`,
    )

    let ready = false
    for (let i = 0; i < 120 && !ready; i++) {
      await sleep(500)
      ready = await serverAnswering()
    }
    if (!ready) {
      throw new Error(`postgres did not answer on ${LAB.host}:${LAB.port} — see ${LAB.logFile}`)
    }
  }

  // Ensure the lab database exists.
  const admin = await connect(ADMIN_URL, 'lab-db:ensure')
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [LAB.database])
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${LAB.database}`)
    console.log(`created database ${LAB.database}`)
  }
  const version = await admin.query('SHOW server_version')
  await admin.end()

  const probe = await connect(LAB_URL, 'lab-db:probe')
  const one = await probe.query('SELECT 1 AS ok')
  await probe.end()

  console.log(
    `lab postgres ready: ${LAB.host}:${LAB.port}/${LAB.database} — version ${version.rows[0].server_version}, probe ${one.rows[0].ok}`,
  )
}

async function stop() {
  const pid = readPostmasterPid()
  if (!pid || !(await serverAnswering())) {
    console.log('not running')
    return
  }

  // Flush first: after a CHECKPOINT the kill below costs almost no recovery.
  const client = await connect(ADMIN_URL, 'lab-db:checkpoint')
  await client.query('CHECKPOINT')
  await client.end()
  console.log('CHECKPOINT done')

  const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' })
  if (result.status !== 0 && !/not found/i.test(result.stderr ?? '')) {
    console.error(result.stdout)
    console.error(result.stderr)
    throw new Error(`taskkill failed with code ${result.status}`)
  }

  for (let i = 0; i < 40; i++) {
    await sleep(250)
    if (!(await serverAnswering())) {
      console.log(`stopped (pid ${pid})`)
      return
    }
  }
  throw new Error('postgres is still answering after taskkill — investigate manually')
}

async function status() {
  const pid = readPostmasterPid()
  const answering = await serverAnswering()
  console.log(`postmaster.pid: ${pid ?? 'absent'} · answering: ${answering}`)
  if (!answering) return

  if (!(await isAnswering())) {
    console.log('server is up; the lab database has not been created yet')
    return
  }

  const client = await connect(LAB_URL, 'lab-db:status')
  const version = await client.query('SELECT version() AS v')
  const size = await client.query('SELECT pg_size_pretty(pg_database_size($1)) AS s', [
    LAB.database,
  ])
  const connections = await client.query(
    'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1',
    [LAB.database],
  )
  const tables = await client.query(
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  )
  const preload = await client.query('SHOW shared_preload_libraries')
  const ssl = await client.query('SHOW ssl')
  await client.end()
  console.log(String(version.rows[0].v).split(' ').slice(0, 2).join(' '))
  console.log(
    `database size ${size.rows[0].s} · connections ${connections.rows[0].n} · public tables ${tables.rows[0].n}`,
  )
  console.log(
    `shared_preload_libraries="${preload.rows[0].shared_preload_libraries}" · ssl=${ssl.rows[0].ssl}`,
  )
}

async function sqlFile(path) {
  const sql = readFileSync(path, 'utf8')
  const client = await connect(LAB_URL, `lab-db:file:${path.split(/[\\/]/).pop()}`)
  const started = Date.now()
  try {
    const result = await client.query(sql)
    const results = Array.isArray(result) ? result : [result]
    for (const r of results) {
      if (r.command === 'SELECT' && r.rows.length > 0) {
        // 60, not 20: the semantic-null-defaults VERIFY file returns 31 checks
        // and a truncated evidence log is worse than a long one.
        console.log(JSON.stringify(r.rows.slice(0, 60), null, 0))
      }
    }
    console.log(`${path} — ${results.length} statement result(s) in ${Date.now() - started} ms`)
  } finally {
    await client.end()
  }
}

async function sql(query) {
  const client = await connect(LAB_URL, 'lab-db:sql')
  try {
    const result = await client.query(query)
    console.log(JSON.stringify(Array.isArray(result) ? result.at(-1).rows : result.rows, null, 2))
  } finally {
    await client.end()
  }
}

const main = async () => {
  switch (command) {
    case 'init':
      return init()
    case 'start':
      return start()
    case 'stop':
      return stop()
    case 'status':
      return status()
    case 'sql-file':
    case 'psql':
      if (!arg) throw new Error('sql-file needs a path')
      return sqlFile(arg)
    case 'sql':
      if (!arg) throw new Error('sql needs a query string')
      return sql(arg)
    default:
      console.log(
        'usage: node performance/scripts/db/lab-db.mjs <init|start|stop|status|sql-file <path>|sql "<query>">',
      )
      process.exit(command ? 1 : 0)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
