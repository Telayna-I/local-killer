import type { ConsumerView } from '../../shared/types'
import type { ProcessIdentity, RawProcess } from '../platform/types'
import { baseName } from './classify'
import type { ProtectionPolicy } from './protect'
import { identityKey } from './tree'

export interface ConsumerRecord {
  view: ConsumerView
  members: ProcessIdentity[]
}

const TOP_CONSUMERS = 12
const IGNORED = new Set(['idle', 'system idle process'])
const MAC_BUNDLE = /\/([^/]+)\.app\//

/** All helpers of an app count as one row: `Google Chrome Helper (Renderer)` → `Google Chrome`. */
function appName(process: RawProcess): string {
  const bundle = MAC_BUNDLE.exec(process.executablePath ?? process.commandLine ?? '')
  return bundle?.[1] ?? process.name.replace(/\.exe$/i, '')
}

export function buildConsumers(
  processes: RawProcess[],
  cpu: Map<string, number>,
  policy: ProtectionPolicy
): ConsumerRecord[] {
  const groups = new Map<string, { name: string; members: RawProcess[] }>()
  for (const process of processes) {
    if (process.pid === 0 || IGNORED.has(baseName(process.name))) continue
    const name = appName(process)
    const key = name.toLowerCase()
    const group = groups.get(key) ?? { name, members: [] }
    group.members.push(process)
    groups.set(key, group)
  }

  const records = [...groups.entries()].map(([key, { name, members }]): ConsumerRecord => ({
    view: {
      id: key,
      name,
      processCount: members.length,
      memoryBytes: members.reduce((sum, p) => sum + (p.memoryBytes ?? 0), 0),
      cpuPercent: members.reduce((sum, p) => sum + (cpu.get(identityKey(p)) ?? 0), 0),
      // Closing skips protected members, so a row is only locked when nothing in it can be closed.
      isProtected: members.every((p) => policy.isProtected(p))
    },
    // Newest first approximates children-before-parents for the forced pass.
    members: members
      .sort((a, b) => b.startTimeMs - a.startTimeMs)
      .map((p) => ({ pid: p.pid, startTimeMs: p.startTimeMs }))
  }))

  return records.sort((a, b) => b.view.memoryBytes - a.view.memoryBytes).slice(0, TOP_CONSUMERS)
}
