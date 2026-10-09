import type { InstanceKind, InstanceView } from '../../../shared/types'

export type KindFilter = Record<InstanceKind, boolean>

export const DEFAULT_KIND_FILTER: KindFilter = { dev: true, other: true, protected: false }

export interface RepoGroup {
  /** repoRoot, or null for the "No repo" group. */
  root: string | null
  name: string | null
  instances: InstanceView[]
  memoryBytes: number
}

export const isKillable = (instance: InstanceView): boolean => instance.kind !== 'protected'

export const totalMemory = (instances: InstanceView[]): number =>
  instances.reduce((sum, instance) => sum + instance.memoryBytes, 0)

export const totalProcesses = (instances: InstanceView[]): number =>
  instances.reduce((sum, instance) => sum + instance.pids.length, 0)

/** Matches label, repo, port (`5173` or `:5173`) and cwd, case-insensitively. */
export function matchesQuery(instance: InstanceView, query: string): boolean {
  const needle = query.trim().toLowerCase().replace(/^:/, '')
  if (needle === '') return true
  const haystack = [
    instance.label,
    instance.repoName,
    instance.repoRoot,
    instance.cwd,
    ...instance.ports.map(String)
  ]
  return haystack.some((value) => value?.toLowerCase().includes(needle))
}

export function filterInstances(
  instances: InstanceView[],
  kinds: KindFilter,
  query: string
): InstanceView[] {
  return instances.filter((instance) => kinds[instance.kind] && matchesQuery(instance, query))
}

/**
 * Keeps the order main already sorted by (kind, orphans first, RAM): a group appears where its
 * first instance does. Instances outside any repo go last.
 */
export function groupByRepo(instances: InstanceView[]): RepoGroup[] {
  const groups = new Map<string | null, RepoGroup>()
  for (const instance of instances) {
    const key = instance.repoRoot
    const group = groups.get(key) ?? {
      root: key,
      name: instance.repoName,
      instances: [],
      memoryBytes: 0
    }
    group.instances.push(instance)
    group.memoryBytes += instance.memoryBytes
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => Number(a.root === null) - Number(b.root === null))
}

export const orphanDevInstances = (instances: InstanceView[]): InstanceView[] =>
  instances.filter((instance) => instance.isOrphan && instance.kind === 'dev')
