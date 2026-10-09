import type { KillFailure, KillResult } from '../../shared/types'
import type { ProcessIdentity, ProcessProvider, RawProcess } from '../platform/types'
import type { ProtectionPolicy } from './protect'
import type { SnapshotService } from './snapshot'
import { instanceMembers } from './members'
import { ProcessTree, identityKey } from './tree'

const pidFromId = (id: string): number => Number.parseInt(id, 10) || 0

/**
 * Every kill re-reads the process list: ids must come from the last snapshot, the root must still
 * be the same process (pid + start time) and members are recomputed with the snapshot boundaries.
 */
export class KillService {
  constructor(
    private readonly provider: ProcessProvider,
    private readonly snapshots: SnapshotService
  ) {}

  async killInstances(ids: string[]): Promise<KillResult> {
    const { tree, policy } = await this.freshTree()
    const failed: KillFailure[] = []
    const targets: RawProcess[] = []
    for (const id of new Set(ids)) {
      const record = this.snapshots.lastIndex.instances.get(id)
      if (record === undefined) {
        failed.push({ pid: pidFromId(id), reason: 'unknown-id' })
        continue
      }
      if (record.view.kind === 'protected') {
        failed.push({ pid: record.root.pid, reason: 'protected' })
        continue
      }
      const root = tree.find(record.root)
      if (root === null) {
        failed.push({ pid: record.root.pid, reason: 'not-found' })
        continue
      }
      if (policy.isProtected(root)) {
        failed.push({ pid: root.pid, reason: 'protected' })
        continue
      }
      // Same boundaries as the snapshot, on the fresh tree: new children are included, but other
      // instances, interactive terminals and protected processes below the root are left alone.
      targets.push(...instanceMembers(root, tree, this.otherRootKeys(id), policy))
    }
    return this.terminate(targets, false, failed)
  }

  private otherRootKeys(id: string): Set<string> {
    const roots = [...this.snapshots.lastIndex.instances.values()].map((r) => identityKey(r.root))
    return new Set(roots.filter((key) => key !== id))
  }

  async closeApps(ids: string[]): Promise<KillResult> {
    const { tree, policy } = await this.freshTree()
    const failed: KillFailure[] = []
    const targets: RawProcess[] = []
    for (const id of new Set(ids)) {
      const record = this.snapshots.lastIndex.consumers.get(id)
      if (record === undefined || record.view.isProtected) {
        failed.push({ pid: 0, reason: record === undefined ? 'unknown-id' : 'protected' })
        continue
      }
      for (const member of record.members) {
        const process = tree.find(member)
        if (process === null) failed.push({ pid: member.pid, reason: 'not-found' })
        else if (policy.isProtected(process)) failed.push({ pid: member.pid, reason: 'protected' })
        else targets.push(process)
      }
    }
    return this.terminate(targets, true, failed)
  }

  private async freshTree(): Promise<{ tree: ProcessTree; policy: ProtectionPolicy }> {
    const tree = new ProcessTree(await this.provider.listProcesses())
    return { tree, policy: this.snapshots.policyFor(tree) }
  }

  private async terminate(
    processes: RawProcess[],
    graceful: boolean,
    failed: KillFailure[]
  ): Promise<KillResult> {
    const unique = [...new Map(processes.map((p) => [p.pid, p])).values()]
    const targets: ProcessIdentity[] = unique.map((p) => ({
      pid: p.pid,
      startTimeMs: p.startTimeMs
    }))
    const outcomes =
      targets.length > 0 ? await this.provider.terminate(targets, graceful) : new Map()
    const killed: number[] = []
    for (const [pid, outcome] of outcomes) {
      if (outcome === 'killed') killed.push(pid)
      else failed.push({ pid, reason: outcome })
    }
    return { killed, failed }
  }
}
