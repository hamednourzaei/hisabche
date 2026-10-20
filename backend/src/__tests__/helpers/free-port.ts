// ============================================
// backend/src/__tests__/helpers/free-port.ts
//
// A TCP port the operating system says is free, for an embedded Postgres.
//
// Every *.pg.test.ts used to pick `5x000 + random(900)`. On Windows a random
// port can be one the OS refuses (EACCES on ::1) or one another program holds;
// Postgres then never starts and the whole file fails with ECONNREFUSED —
// a red that is gone on the next run. Asking the OS (listen on port 0) removes
// the guess. It is synchronous because each file builds its Postgres at module
// load; a tiny child process does the asking.
// ============================================

import { execFileSync } from 'node:child_process'

const ASK =
  "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close()})"

export function freePortSync(): number {
  const port = Number(execFileSync(process.execPath, ['-e', ASK], { encoding: 'utf8' }).trim())
  if (!Number.isInteger(port) || port <= 0)
    throw new Error(`free-port: no port from the OS (${port})`)
  return port
}
