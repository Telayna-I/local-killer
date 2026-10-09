import { posix } from 'node:path'
import type { RawProcess } from '../types'
import { commandLineFromArgv } from '../parse/argv'
import {
  PS_PROCESS_COLUMNS,
  PS_START_COLUMNS,
  commandLineFromPsArgs,
  nameFromPsArgs,
  parsePsProcesses,
  parsePsStartTimes
} from '../parse/darwin'
import { libSystem, type LibSystem } from './ffi'
import { PS, run } from './run'

interface Identity {
  executablePath: string | null
  commandLine: string | null
}

/** Executable path and argv never change for a pid + start time, so each process is read once. */
const identityCache = new Map<string, Identity>()

/**
 * ps gives every process with its start time; libSystem adds the real executable path (any user)
 * and argv with its word boundaries (own processes; ps joins arguments with plain spaces).
 */
function readIdentity(lib: LibSystem | null, pid: number, args: string, isOwn: boolean): Identity {
  const argv = lib !== null && isOwn ? (lib.procArgs(pid)?.argv ?? null) : null
  return {
    executablePath: lib?.executablePath(pid) ?? null,
    commandLine:
      argv !== null && argv.length > 0 ? commandLineFromArgv(argv) : commandLineFromPsArgs(args)
  }
}

export async function listProcesses(): Promise<RawProcess[]> {
  const [output, lib] = await Promise.all([
    run(PS, ['-axww', '-o', PS_PROCESS_COLUMNS]),
    libSystem()
  ])
  const self = process.getuid?.()
  const seen = new Set<string>()
  const processes: RawProcess[] = []
  for (const row of parsePsProcesses(output)) {
    if (row.state.startsWith('Z')) continue
    const key = `${row.pid}-${row.startTimeMs}`
    seen.add(key)
    let identity = identityCache.get(key)
    if (identity === undefined) {
      identity = readIdentity(lib, row.pid, row.args, row.uid === self)
      identityCache.set(key, identity)
    }
    const { executablePath, commandLine } = identity
    processes.push({
      pid: row.pid,
      ppid: row.ppid,
      name: executablePath === null ? nameFromPsArgs(row.args) : posix.basename(executablePath),
      startTimeMs: row.startTimeMs,
      cpuTimeMs: row.cpuTimeMs,
      memoryBytes: row.rssKb === null ? null : row.rssKb * 1024,
      commandLine,
      executablePath,
      isSystem: row.uid !== self
    })
  }
  for (const key of identityCache.keys()) if (!seen.has(key)) identityCache.delete(key)
  return processes
}

let pending: { pids: Set<number>; times: Promise<Map<number, number>> } | null = null

/**
 * Start time as listProcesses reports it (same ps column, same parser), so identities always
 * compare equal. Concurrent callers share a single `ps -p` run.
 */
export function startTimeOf(pid: number): Promise<number | null> {
  if (pending === null) {
    const pids = new Set<number>()
    const times = Promise.resolve().then(async () => {
      pending = null
      return parsePsStartTimes(await run(PS, ['-o', PS_START_COLUMNS, '-p', [...pids].join(',')]))
    })
    pending = { pids, times }
  }
  pending.pids.add(pid)
  return pending.times.then((times) => times.get(pid) ?? null)
}
