import { execFile } from 'node:child_process'
import { readFileSync, readdirSync, readlinkSync, statSync } from 'node:fs'
import { posix } from 'node:path'
import type { ProcessDetails, ProcessIdentity, RawProcess } from '../types'
import { parseEnvironmentBlock } from '../parse/environment'
import {
  isDeadState,
  parseBootTime,
  parseProcCmdline,
  parseProcStat,
  type ProcStat
} from '../parse/procfs'

export interface ProcConstants {
  clockTicks: number
  pageSize: number
  bootTimeMs: number
}

function getconf(name: string, fallback: number): Promise<number> {
  return new Promise((resolve) =>
    execFile('getconf', [name], (error, stdout) => {
      const value = Number(String(stdout).trim())
      resolve(error === null && Number.isSafeInteger(value) && value > 0 ? value : fallback)
    })
  )
}

let constants: Promise<ProcConstants> | null = null

/**
 * Read once: `btime` shifts when the wall clock is stepped, and start times (part of a process'
 * identity) must not change while the app runs.
 */
export function procConstants(): Promise<ProcConstants> {
  constants ??= (async () => {
    const [clockTicks, pageSize] = await Promise.all([
      getconf('CLK_TCK', 100),
      getconf('PAGESIZE', 4096)
    ])
    const bootTime = parseBootTime(readText('/proc/stat') ?? '') ?? 0
    return { clockTicks, pageSize, bootTimeMs: bootTime * 1000 }
  })()
  return constants
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/** readlink, without the ` (deleted)` the kernel appends when the target is gone. */
function readLink(path: string): string | null {
  try {
    return readlinkSync(path).replace(/ \(deleted\)$/, '')
  } catch {
    return null
  }
}

function readStat(pid: number): ProcStat | null {
  const content = readText(`/proc/${pid}/stat`)
  return content === null ? null : parseProcStat(content)
}

const ticksToMs = (ticks: number, c: ProcConstants): number =>
  Math.floor((ticks * 1000) / c.clockTicks)

const startTimeMs = (stat: ProcStat, c: ProcConstants): number =>
  c.bootTimeMs + ticksToMs(stat.startTicks, c)

export function readStartTime(pid: number, c: ProcConstants): number | null {
  const stat = readStat(pid)
  return stat === null || isDeadState(stat.state) ? null : startTimeMs(stat, c)
}

function ownerUid(pid: number): number | null {
  try {
    return statSync(`/proc/${pid}`).uid
  } catch {
    return null
  }
}

/**
 * Every process in /proc. `exe` is only readable for our own processes; other ones fall back to
 * the kernel name. Processes vanishing mid-read are skipped.
 */
export function listProcesses(c: ProcConstants): RawProcess[] {
  const self = process.getuid?.()
  const processes: RawProcess[] = []
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    const pid = Number(entry)
    const stat = readStat(pid)
    const uid = ownerUid(pid)
    if (stat === null || uid === null || isDeadState(stat.state)) continue
    const executablePath = readLink(`/proc/${pid}/exe`)
    const cmdline = readText(`/proc/${pid}/cmdline`)
    processes.push({
      pid,
      ppid: stat.ppid,
      name: executablePath === null ? stat.comm : posix.basename(executablePath),
      startTimeMs: startTimeMs(stat, c),
      cpuTimeMs: ticksToMs(stat.utimeTicks + stat.stimeTicks, c),
      memoryBytes: stat.rssPages * c.pageSize,
      commandLine: cmdline === null ? null : parseProcCmdline(cmdline),
      executablePath,
      isSystem: uid !== self
    })
  }
  return processes
}

/** cwd + environ, checking the start time before and after so a recycled PID is never read. */
export function readDetails(target: ProcessIdentity, c: ProcConstants): ProcessDetails | null {
  const sameProcess = (): boolean => readStartTime(target.pid, c) === target.startTimeMs
  if (!sameProcess()) return null
  const cwd = readLink(`/proc/${target.pid}/cwd`)
  const environ = readText(`/proc/${target.pid}/environ`)
  if (!sameProcess() || (cwd === null && environ === null)) return null
  return { cwd, env: environ === null ? null : parseEnvironmentBlock(environ) }
}
