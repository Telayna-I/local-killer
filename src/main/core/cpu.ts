import { availableParallelism } from 'node:os'
import type { RawProcess } from '../platform/types'
import { identityKey } from './tree'

/** CPU% from the delta of cumulative CPU time between two polls, normalized to all cores. */
export class CpuTracker {
  private previous = new Map<string, number>()
  private previousAt = 0

  constructor(private readonly cores: number = availableParallelism()) {}

  sample(processes: RawProcess[], now: number): Map<string, number> {
    const elapsed = now - this.previousAt
    const current = new Map<string, number>()
    const percents = new Map<string, number>()
    for (const process of processes) {
      if (process.cpuTimeMs === null) continue
      const key = identityKey(process)
      current.set(key, process.cpuTimeMs)
      const before = this.previous.get(key)
      if (before === undefined || elapsed <= 0) continue
      const percent = ((process.cpuTimeMs - before) / elapsed / this.cores) * 100
      percents.set(key, Math.max(0, Math.min(100, percent)))
    }
    this.previous = current
    this.previousAt = now
    return percents
  }
}
