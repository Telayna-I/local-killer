import type { InstanceKind, InstanceView } from '../../shared/types'
import type { ProcessDetails, ProcessIdentity, RawListener, RawProcess } from '../platform/types'
import { baseName, isDevRuntime } from './classify'
import { describeCommand, tokenize } from './label'
import { findLaunchRoot, hasLostParent } from './launch-root'
import { instanceMembers } from './members'
import { claudeSessionPid, detectOrigin } from './origin'
import type { ProtectionPolicy } from './protect'
import { directoryFromCommandLine, type RepoResolver } from './repo-root'
import { identityKey, type ProcessTree } from './tree'

export interface InstanceRecord {
  view: InstanceView
  root: ProcessIdentity
}

export interface InstanceInput {
  tree: ProcessTree
  listeners: RawListener[]
  details: Map<string, ProcessDetails | null>
  cpu: Map<string, number>
  policy: ProtectionPolicy
  repos: RepoResolver
}

const KIND_ORDER: Record<InstanceKind, number> = { dev: 0, other: 1, protected: 2 }

function portsByPid(listeners: RawListener[]): Map<number, Set<number>> {
  const ports = new Map<number, Set<number>>()
  for (const { pid, port } of listeners) {
    if (pid === 0) continue
    ports.set(pid, (ports.get(pid) ?? new Set()).add(port))
  }
  return ports
}

/** The Claude session named in CLAUDE_PID is gone (or its PID now belongs to someone else). */
function claudeSessionGone(process: RawProcess, input: InstanceInput): boolean {
  const sessionPid = claudeSessionPid(input.details.get(identityKey(process))?.env ?? null)
  if (sessionPid === null) return false
  const session = input.tree.byPid.get(sessionPid)
  return (
    session === undefined ||
    session.startTimeMs > process.startTimeMs ||
    !/claude|node/.test(baseName(session.name))
  )
}

/** Listeners, plus dev runtimes whose launcher (terminal, Claude session) is gone. */
function findSeeds(input: InstanceInput, ports: Map<number, Set<number>>): RawProcess[] {
  const seeds: RawProcess[] = []
  for (const process of input.tree.byPid.values()) {
    if (ports.has(process.pid)) {
      seeds.push(process)
    } else if (isDevRuntime(process) && !input.policy.isProtected(process)) {
      const lost = hasLostParent(process, input.tree) || claudeSessionGone(process, input)
      if (lost) seeds.push(process)
    }
  }
  return seeds
}

function buildRecord(
  root: RawProcess,
  seed: RawProcess,
  subtree: RawProcess[],
  input: InstanceInput,
  ports: Map<number, Set<number>>
): InstanceRecord | null {
  const { tree, policy } = input
  const details =
    input.details.get(identityKey(seed)) ?? input.details.get(identityKey(root)) ?? null
  const cwd = details?.cwd ?? directoryFromCommandLine(tokenize(seed.commandLine ?? ''))
  const repo = input.repos.resolve(cwd)
  const origin = detectOrigin(details?.env ?? null, tree.ancestorsOf(root))
  const instancePorts = [...new Set(subtree.flatMap((p) => [...(ports.get(p.pid) ?? [])]))].sort(
    (a, b) => a - b
  )
  const isProtected = policy.isProtected(seed) || policy.isProtected(root)
  const isDev = subtree.some(isDevRuntime) || repo !== null
  // Orphan dev processes outside any repo are usually helpers of some app, not a forgotten project.
  if (instancePorts.length === 0 && repo === null && origin !== 'claude-code') return null

  return {
    root: { pid: root.pid, startTimeMs: root.startTimeMs },
    view: {
      id: identityKey(root),
      kind: isProtected ? 'protected' : isDev ? 'dev' : 'other',
      label: describeCommand(seed.name, seed.commandLine),
      commandLine: seed.commandLine,
      cwd,
      repoRoot: repo?.root ?? null,
      repoName: repo?.name ?? null,
      origin,
      isOrphan: hasLostParent(root, tree) || claudeSessionGone(seed, input),
      ports: instancePorts,
      pids: subtree.map((p) => p.pid),
      memoryBytes: subtree.reduce((sum, p) => sum + (p.memoryBytes ?? 0), 0),
      cpuPercent: subtree.reduce((sum, p) => sum + (input.cpu.get(identityKey(p)) ?? 0), 0),
      startedAt: root.startTimeMs,
      limited: details === null && !isProtected
    }
  }
}

export function buildInstances(input: InstanceInput): InstanceRecord[] {
  const ports = portsByPid(input.listeners)
  const seedByRoot = new Map<string, { root: RawProcess; seed: RawProcess }>()
  for (const seed of findSeeds(input, ports)) {
    const root = input.policy.isProtected(seed)
      ? seed
      : findLaunchRoot(seed, input.tree, (p) => input.policy.isProtected(p))
    const key = identityKey(root)
    const current = seedByRoot.get(key)
    // Prefer a listening seed for the label/details: it's the process the user cares about.
    if (current === undefined || (!ports.has(current.seed.pid) && ports.has(seed.pid))) {
      seedByRoot.set(key, { root, seed })
    }
  }

  const rootKeys = new Set(seedByRoot.keys())
  const records: InstanceRecord[] = []
  for (const [key, { root, seed }] of seedByRoot) {
    const otherRoots = new Set([...rootKeys].filter((other) => other !== key))
    const members = instanceMembers(root, input.tree, otherRoots, input.policy)
    const record = buildRecord(root, seed, members, input, ports)
    if (record !== null) records.push(record)
  }
  return records.sort(
    (a, b) =>
      KIND_ORDER[a.view.kind] - KIND_ORDER[b.view.kind] ||
      Number(b.view.isOrphan) - Number(a.view.isOrphan) ||
      b.view.memoryBytes - a.view.memoryBytes
  )
}

/** Processes worth reading cwd/env from (PEB / procfs): never protected or system ones. */
export function needsDetails(
  process: RawProcess,
  listening: Set<number>,
  policy: ProtectionPolicy
): boolean {
  if (policy.isProtected(process)) return false
  return listening.has(process.pid) || isDevRuntime(process)
}
