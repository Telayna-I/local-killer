import { describe, expect, it } from 'vitest'
import { CpuTracker } from '../../../src/main/core/cpu'
import { KillService } from '../../../src/main/core/kill-service'
import { SnapshotService } from '../../../src/main/core/snapshot'
import type {
  ProcessIdentity,
  ProcessProvider,
  RawListener,
  RawProcess
} from '../../../src/main/platform/types'
import { proc } from '../fixtures'

function fakeProvider(
  processes: RawProcess[],
  listeners: RawListener[]
): { provider: ProcessProvider; terminated: ProcessIdentity[][] } {
  const terminated: ProcessIdentity[][] = []
  const provider: ProcessProvider = {
    listProcesses: async () => processes,
    listListeners: async () => listeners,
    getDetails: async () => ({ cwd: null, env: { CLAUDE_CODE_CHILD_SESSION: '1' } }),
    terminate: async (targets) => {
      terminated.push(targets)
      return new Map(targets.map((t) => [t.pid, 'killed' as const]))
    }
  }
  return { provider, terminated }
}

const settings = { language: null, pollIntervalMs: 3000, protectedNames: ['mysqld'] }

describe('KillService', () => {
  it('kills the whole instance tree leaves first but skips protected members', async () => {
    const self = proc({ pid: 1, name: 'electron.exe' })
    const shell = proc({ pid: 2, ppid: 99, name: 'bash.exe', commandLine: 'bash -c dev' })
    const server = proc({ pid: 3, ppid: 2, name: 'node.exe' })
    const mysql = proc({ pid: 4, ppid: 2, name: 'mysqld.exe' })
    const { provider, terminated } = fakeProvider(
      [self, shell, server, mysql],
      [{ pid: 3, port: 3000, address: '::' }]
    )
    const snapshots = new SnapshotService(provider, () => settings, { selfPid: 1 })
    const [instance] = (await snapshots.take()).instances

    const result = await new KillService(provider, snapshots).killInstances([instance.id])

    expect(terminated[0].map((t) => t.pid)).toEqual([3, 2])
    expect(result.killed).toEqual([3, 2])
    expect(result.failed).toEqual([{ pid: 4, reason: 'protected' }])
  })

  it('refuses ids the last snapshot never issued', async () => {
    const { provider, terminated } = fakeProvider([proc({ pid: 5, name: 'node.exe' })], [])
    const snapshots = new SnapshotService(provider, () => settings, { selfPid: 1 })
    await snapshots.take()

    const result = await new KillService(provider, snapshots).killInstances(['5-123'])

    expect(terminated).toEqual([])
    expect(result.failed).toEqual([{ pid: 5, reason: 'unknown-id' }])
  })

  it('never kills LocalKiller or its launcher chain', async () => {
    const terminal = proc({ pid: 10, name: 'bash.exe', commandLine: 'bash -c "npm run dev"' })
    const self = proc({ pid: 11, ppid: 10, name: 'node.exe' })
    const { provider } = fakeProvider([terminal, self], [{ pid: 11, port: 9000, address: '::' }])
    const snapshots = new SnapshotService(provider, () => settings, { selfPid: 11 })
    const [instance] = (await snapshots.take()).instances

    expect(instance.kind).toBe('protected')
    const result = await new KillService(provider, snapshots).killInstances([instance.id])
    expect(result.killed).toEqual([])
  })
})

describe('CpuTracker', () => {
  it('computes percent of all cores from cpu time deltas', () => {
    const tracker = new CpuTracker(4)
    const node = proc({ pid: 1, name: 'node', cpuTimeMs: 1000 })
    tracker.sample([node], 10_000)
    const percents = tracker.sample([{ ...node, cpuTimeMs: 3000 }], 11_000)

    expect(percents.get(`1-${node.startTimeMs}`)).toBe(50)
  })
})
