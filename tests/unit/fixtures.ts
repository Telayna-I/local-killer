import type { RawProcess } from '../../src/main/platform/types'

let nextPid = 1000

/** Builds a RawProcess with sensible defaults; start times grow with pid unless given. */
export function proc(overrides: Partial<RawProcess> & { name: string }): RawProcess {
  const pid = overrides.pid ?? nextPid++
  return {
    pid,
    ppid: 0,
    startTimeMs: 1_000_000 + pid,
    cpuTimeMs: 0,
    memoryBytes: 10 * 1024 * 1024,
    commandLine: overrides.name,
    executablePath: null,
    isSystem: false,
    ...overrides
  }
}
