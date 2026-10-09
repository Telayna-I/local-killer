import type { ProcessIdentity, RawProcess } from '../platform/types'

export function identityKey(process: ProcessIdentity): string {
  return `${process.pid}-${process.startTimeMs}`
}

/**
 * Process tree that survives PID reuse: a parent link only counts when the parent started before
 * the child. Windows never rewrites a stale PPID, so a dead parent's PID may belong to anyone.
 */
export class ProcessTree {
  readonly byPid = new Map<number, RawProcess>()
  private readonly children = new Map<number, RawProcess[]>()

  constructor(processes: RawProcess[]) {
    for (const process of processes) this.byPid.set(process.pid, process)
    for (const process of processes) {
      const parent = this.parentOf(process)
      if (parent === null) continue
      const siblings = this.children.get(parent.pid) ?? []
      siblings.push(process)
      this.children.set(parent.pid, siblings)
    }
  }

  parentOf(process: RawProcess): RawProcess | null {
    if (process.ppid === process.pid || process.ppid === 0) return null
    const parent = this.byPid.get(process.ppid)
    if (parent === undefined) return null
    const startsKnown = parent.startTimeMs > 0 && process.startTimeMs > 0
    return startsKnown && parent.startTimeMs > process.startTimeMs ? null : parent
  }

  childrenOf(process: RawProcess): RawProcess[] {
    return this.children.get(process.pid) ?? []
  }

  /** Living ancestors, closest first. */
  ancestorsOf(process: RawProcess): RawProcess[] {
    const ancestors: RawProcess[] = []
    const visited = new Set([process.pid])
    let current = this.parentOf(process)
    while (current !== null && !visited.has(current.pid)) {
      ancestors.push(current)
      visited.add(current.pid)
      current = this.parentOf(current)
    }
    return ancestors
  }

  /** The process and all its descendants, leaves first (kill order). */
  subtreeLeavesFirst(root: RawProcess): RawProcess[] {
    const ordered: RawProcess[] = []
    const visited = new Set<number>()
    const visit = (process: RawProcess): void => {
      if (visited.has(process.pid)) return
      visited.add(process.pid)
      for (const child of this.childrenOf(process)) visit(child)
      ordered.push(process)
    }
    visit(root)
    return ordered
  }

  find(identity: ProcessIdentity): RawProcess | null {
    const process = this.byPid.get(identity.pid)
    return process !== undefined && process.startTimeMs === identity.startTimeMs ? process : null
  }
}
