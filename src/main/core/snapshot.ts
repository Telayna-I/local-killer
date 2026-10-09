import { freemem, totalmem } from 'node:os'
import type { Settings, Snapshot } from '../../shared/types'
import type { ProcessDetails, ProcessProvider, RawProcess } from '../platform/types'
import { buildConsumers, type ConsumerRecord } from './consumers'
import { CpuTracker } from './cpu'
import { buildInstances, needsDetails, type InstanceRecord } from './instances'
import { ProtectionPolicy } from './protect'
import { RepoResolver } from './repo-root'
import { ProcessTree, identityKey } from './tree'

export interface SnapshotIndex {
  instances: Map<string, InstanceRecord>
  consumers: Map<string, ConsumerRecord>
}

/**
 * LocalKiller and whoever launched it (in dev: electron-vite, npm, the terminal...) are untouchable.
 * Electron's own helper processes are covered by protecting the app's executable name.
 */
export function launcherChain(tree: ProcessTree, selfPid: number): Set<number> {
  const self = tree.byPid.get(selfPid)
  if (self === undefined) return new Set([selfPid])
  return new Set([self, ...tree.ancestorsOf(self)].map((p) => p.pid))
}

export class SnapshotService {
  private readonly cpu = new CpuTracker()
  private readonly repos = new RepoResolver()
  private details = new Map<string, ProcessDetails | null>()
  private index: SnapshotIndex = { instances: new Map(), consumers: new Map() }

  constructor(
    private readonly provider: ProcessProvider,
    private readonly getSettings: () => Settings,
    private readonly options: { selfPid?: number; extraProtectedNames?: string[] } = {}
  ) {}

  /** Ids handed to the renderer in the last snapshot: the only ones accepted back for killing. */
  get lastIndex(): SnapshotIndex {
    return this.index
  }

  policyFor(tree: ProcessTree): ProtectionPolicy {
    const names = [
      ...this.getSettings().protectedNames,
      ...(this.options.extraProtectedNames ?? [])
    ]
    return new ProtectionPolicy(names, launcherChain(tree, this.options.selfPid ?? process.pid))
  }

  async take(): Promise<Snapshot> {
    const [processes, listeners] = await Promise.all([
      this.provider.listProcesses(),
      this.provider.listListeners()
    ])
    const takenAt = Date.now()
    const tree = new ProcessTree(processes)
    const policy = this.policyFor(tree)
    const listening = new Set(listeners.map((l) => l.pid))
    await this.refreshDetails(processes.filter((p) => needsDetails(p, listening, policy)))

    const cpu = this.cpu.sample(processes, takenAt)
    const instances = buildInstances({
      tree,
      listeners,
      details: this.details,
      cpu,
      policy,
      repos: this.repos
    })
    const consumers = buildConsumers(processes, cpu, policy)
    this.index = {
      instances: new Map(instances.map((r) => [r.view.id, r])),
      consumers: new Map(consumers.map((r) => [r.view.id, r]))
    }
    return {
      takenAt,
      platform: process.platform,
      instances: instances.map((r) => r.view),
      topConsumers: consumers.map((r) => r.view),
      memory: { totalBytes: totalmem(), freeBytes: freemem() }
    }
  }

  /** cwd/env never change for a given pid+start, so each process is read once. */
  private async refreshDetails(candidates: RawProcess[]): Promise<void> {
    const next = new Map<string, ProcessDetails | null>()
    await Promise.all(
      candidates.map(async (process) => {
        const key = identityKey(process)
        const known = this.details.get(key)
        next.set(key, known !== undefined ? known : await this.provider.getDetails(process))
      })
    )
    this.details = next
  }
}
