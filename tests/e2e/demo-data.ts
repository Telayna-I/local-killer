import type {
  ContainerView,
  ConsumerView,
  DockerState,
  InstanceKind,
  InstanceView,
  Origin,
  Settings,
  Snapshot,
  UpdateState
} from '../../src/shared/types'

/** Fictional machine for README screenshots: no real paths, every UI state on show. */
const MB = 1024 * 1024
const MINUTE = 60_000
const HOUR = 60 * MINUTE

// [label, repo, kind, origin, orphan, ports, processes, RAM MB, CPU %, uptime ms, limited]
type Row = [
  string,
  string | null,
  InstanceKind,
  Origin,
  boolean,
  number[],
  number,
  number,
  number,
  number,
  boolean?
]

const INSTANCES: Row[] = [
  ['next dev', 'storefront', 'dev', 'claude-code', true, [3000], 5, 1180, 0.4, 26 * HOUR],
  ['vite', 'storefront', 'dev', 'claude-code', false, [5173], 2, 214, 1.2, 42 * MINUTE],
  ['tsx watch src/worker.ts', 'storefront', 'dev', 'claude-code', true, [], 2, 168, 0, 72 * HOUR],
  ['artisan serve', 'billing-api', 'dev', 'vscode', false, [8000], 2, 96, 0.1, 125 * MINUTE],
  ['artisan queue:work', 'billing-api', 'dev', 'terminal', true, [], 1, 71, 0, 19 * HOUR],
  ['astro dev', 'docs-site', 'dev', 'cursor', false, [4321], 3, 188, 2.6, 12 * MINUTE],
  ['uvicorn app.main:app', 'ml-sandbox', 'dev', 'jetbrains', false, [8001], 2, 342, 0.8, 5 * HOUR],
  ['discord', null, 'other', 'unknown', false, [6463], 1, 409, 0.3, 30 * HOUR],
  ['remoteserverwin', null, 'other', 'unknown', false, [9510, 9512], 1, 16, 0, 30 * HOUR, true],
  ['postgres', null, 'protected', 'unknown', false, [5432], 3, 120, 0, 30 * HOUR]
]

// [name, processes, RAM MB, CPU %, protected]
const CONSUMERS: [string, number, number, number, boolean][] = [
  ['chrome', 30, 3514, 4.1, false],
  ['node', 33, 2424, 3.2, false],
  ['Code', 14, 1630, 1.4, false],
  ['claude', 7, 1286, 0.9, true],
  ['Discord', 6, 850, 0.3, false],
  ['Slack', 5, 640, 0.2, false],
  ['docker desktop', 4, 520, 0.4, true],
  ['explorer', 1, 270, 0.1, true],
  ['Spotify', 6, 251, 0.6, false]
]

// [name, image, ports, status, compose project]
const CONTAINERS: [string, string, string, string, string | null][] = [
  ['storefront-db-1', 'postgres:16-alpine', '0.0.0.0:5433->5432/tcp', 'Up 3 hours', 'storefront'],
  ['storefront-redis-1', 'redis:7', '0.0.0.0:6379->6379/tcp', 'Up 3 hours', 'storefront'],
  [
    'billing-mailpit-1',
    'axllent/mailpit:latest',
    '0.0.0.0:8025->8025/tcp, 0.0.0.0:1025->1025/tcp',
    'Up 2 days',
    'billing-api'
  ],
  ['minio', 'minio/minio', '0.0.0.0:9000-9001->9000-9001/tcp', 'Up 5 days (healthy)', null]
]

const repoPath = (name: string | null): string | null => (name ? `C:\\code\\${name}` : null)

const KIND_ORDER: Record<InstanceKind, number> = { dev: 0, other: 1, protected: 2 }

/** Same order main sends: kind, orphans first, then RAM. */
const mainOrder = (a: InstanceView, b: InstanceView): number =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
  Number(b.isOrphan) - Number(a.isOrphan) ||
  b.memoryBytes - a.memoryBytes

export interface DemoData {
  snapshot: Snapshot
  docker: DockerState
  settings: Settings
  update: UpdateState
}

export function demoData(protectedNames: string[]): DemoData {
  const at = new Date()
  at.setHours(14, 32, 8, 0)
  const takenAt = at.getTime()
  let pid = 4000

  const instances = INSTANCES.map(
    ([label, repo, kind, origin, isOrphan, ports, processes, ram, cpu, up, limited], index) =>
      ({
        id: `demo-${index}`,
        kind,
        label,
        commandLine: `node ${label}`,
        cwd: repoPath(repo),
        repoRoot: repoPath(repo),
        repoName: repo,
        origin,
        isOrphan,
        ports,
        pids: Array.from({ length: processes }, () => (pid += 17)),
        memoryBytes: ram * MB,
        cpuPercent: cpu,
        startedAt: takenAt - up,
        limited: limited ?? false
      }) satisfies InstanceView
  ).sort(mainOrder)
  const topConsumers = CONSUMERS.map(
    ([name, processCount, ram, cpuPercent, isProtected], index): ConsumerView => ({
      id: `consumer-${index}`,
      name,
      processCount,
      memoryBytes: ram * MB,
      cpuPercent,
      isProtected
    })
  )
  const containers = CONTAINERS.map(
    ([name, image, ports, status, composeProject], index): ContainerView => ({
      id: `container-${index}`,
      name,
      image,
      ports,
      status,
      composeProject,
      workingDir: repoPath(composeProject)
    })
  )

  return {
    snapshot: {
      takenAt,
      platform: 'win32',
      instances,
      topConsumers,
      memory: { totalBytes: 32 * 1024 * MB, freeBytes: 9.4 * 1024 * MB }
    },
    docker: { available: true, containers },
    settings: { language: 'en', pollIntervalMs: 3000, protectedNames },
    update: { status: 'downloaded', version: '0.2.0' }
  }
}
