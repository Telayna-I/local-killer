import type { ProcessDetails, ProcessIdentity } from '../types'
import { parseLsofCwd } from '../parse/darwin'
import { libSystem } from './ffi'
import { startTimeOf } from './processes'
import { LSOF, run } from './run'

async function cwdFromLsof(pid: number): Promise<string | null> {
  return parseLsofCwd(await run(LSOF, ['-a', '-w', '-p', String(pid), '-d', 'cwd', '-Fn']))
}

/**
 * cwd (libproc) and environment (KERN_PROCARGS2) of one of our own processes. The start time is
 * checked before and after reading, so a recycled PID is never reported as the original process.
 */
export async function readDetails(target: ProcessIdentity): Promise<ProcessDetails | null> {
  const [before, lib] = await Promise.all([startTimeOf(target.pid), libSystem()])
  if (before !== target.startTimeMs) return null
  const cwd = lib !== null ? lib.cwd(target.pid) : await cwdFromLsof(target.pid)
  const env = lib?.procArgs(target.pid)?.env ?? null
  if ((await startTimeOf(target.pid)) !== target.startTimeMs) return null
  return cwd === null && env === null ? null : { cwd, env }
}
