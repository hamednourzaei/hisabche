// ============================================
// backend/src/utils/system-metrics.ts
//
// CPU and memory of the MACHINE THIS INSTANCE RUNS ON — the container on
// Render, the whole computer elsewhere — as percentages of what it has.
//
// ⚠️ NOT THE NODE PROCESS. The first version reported process.cpuUsage() and
// the process's RSS against total RAM: 0.1 % CPU and 0.4 % RAM on a machine
// Task Manager showed at 6 % and 37 % (reported 26 Sep 2026). On Render the
// container is little more than this process, so the two nearly coincide
// there — but the question the bar answers is «how loaded is the server».
//
// ⚠️ THE CONTAINER, NOT THE HOST. Inside a container `os` sees the host:
// os.totalmem() is the host's RAM and os.cpus() its cores. The container's
// real limits and usage live in cgroups (v2: memory.current / memory.max,
// cpu.stat usage_usec, cpu.max; v1: memory/…, cpuacct/…). `os` is used only
// where no cgroup limit exists (a dev machine) — and there, the machine IS
// the server.
//
// Public by the owner's decision (26 Sep 2026): percentages, uptime and
// in-flight requests only — no hostname, version, commit or byte counts.
// ============================================

import { readFileSync } from 'node:fs'
import os from 'node:os'

export interface SystemSample {
  /** Share of the machine's (container's) CPU in use since the previous sample, 0–100. */
  cpuPercent: number
  /** Share of the machine's (container's) memory in use, 0–100. */
  memoryPercent: number
  uptimeSeconds: number
  inflightRequests: number
  /** ISO time of the sample. */
  at: string
}

function read(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return null
  }
}

/** A cgroup "limit" this large means none (v1 writes ~2^63 for unlimited). */
const UNLIMITED = 2 ** 60

/** Bytes: [used, total] — the container's when it has a limit, else the machine's. */
export function memoryUsage(): [number, number] {
  const v2Max = read('/sys/fs/cgroup/memory.max')
  const v2Cur = read('/sys/fs/cgroup/memory.current')
  if (v2Max && v2Max !== 'max' && v2Cur) {
    const limit = Number(v2Max)
    if (limit > 0 && limit < UNLIMITED) return [Number(v2Cur), limit]
  }
  const v1Max = read('/sys/fs/cgroup/memory/memory.limit_in_bytes')
  const v1Cur = read('/sys/fs/cgroup/memory/memory.usage_in_bytes')
  if (v1Max && v1Cur) {
    const limit = Number(v1Max)
    if (limit > 0 && limit < UNLIMITED) return [Number(v1Cur), limit]
  }
  // The whole machine — what Task Manager / `free` report.
  const total = os.totalmem()
  return [total - os.freemem(), total]
}

/** How many cores the container may use; null when it has no CPU limit. */
export function cpuAllowance(): number | null {
  const v2 = read('/sys/fs/cgroup/cpu.max') // "<quota> <period>" or "max <period>"
  if (v2) {
    const [quota, period] = v2.split(/\s+/)
    if (quota && quota !== 'max' && Number(period) > 0) return Number(quota) / Number(period)
  }
  const quota = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'))
  const period = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_period_us'))
  if (quota > 0 && period > 0) return quota / period
  return null
}

/** CPU time the whole container has used, in µs; null outside a cgroup. */
function containerCpuMicros(): number | null {
  const stat = read('/sys/fs/cgroup/cpu.stat') // v2: "usage_usec N"
  const v2 = stat ? /usage_usec (\d+)/.exec(stat)?.[1] : undefined
  if (v2) return Number(v2)
  const v1 = read('/sys/fs/cgroup/cpuacct/cpuacct.usage') // v1: nanoseconds
  return v1 ? Number(v1) / 1000 : null
}

/** Busy and total CPU time across every core of the machine. */
function machineCpuTimes(): { busy: number; total: number } {
  let busy = 0
  let total = 0
  for (const cpu of os.cpus()) {
    const { user, nice, sys, idle, irq } = cpu.times
    busy += user + nice + sys + irq
    total += user + nice + sys + idle + irq
  }
  return { busy, total }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10))

/**
 * CPU is a RATE: it needs two readings. Each call measures since the previous
 * one — the container's usage against its allowance when it has a cgroup
 * limit, otherwise every core of the machine.
 */
export function createSampler(inflight: () => number) {
  let lastAt = process.hrtime.bigint()
  let lastContainer = containerCpuMicros()
  let lastMachine = machineCpuTimes()

  return function sample(): SystemSample {
    const now = process.hrtime.bigint()
    const elapsedMicros = Number(now - lastAt) / 1000
    lastAt = now

    let cpuPercent = 0
    const allowance = cpuAllowance()
    const container = containerCpuMicros()
    if (container !== null && lastContainer !== null && allowance !== null && elapsedMicros > 0) {
      cpuPercent = ((container - lastContainer) / (elapsedMicros * allowance)) * 100
    } else {
      const machine = machineCpuTimes()
      const total = machine.total - lastMachine.total
      cpuPercent = total > 0 ? ((machine.busy - lastMachine.busy) / total) * 100 : 0
      lastMachine = machine
    }
    lastContainer = container

    const [used, limit] = memoryUsage()
    return {
      cpuPercent: clamp(cpuPercent),
      memoryPercent: clamp((used / limit) * 100),
      uptimeSeconds: Math.floor(process.uptime()),
      inflightRequests: inflight(),
      at: new Date().toISOString(),
    }
  }
}
