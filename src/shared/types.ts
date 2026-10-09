export type Origin = 'claude-code' | 'vscode' | 'cursor' | 'jetbrains' | 'terminal' | 'unknown'

/** dev = a project you started; other = non-dev app listening on a port; protected = never killable. */
export type InstanceKind = 'dev' | 'other' | 'protected'

export type Language = 'es' | 'en'

export interface InstanceView {
  /** `${pid}-${startTimeMs}` of the launch root; only ids from the last snapshot are accepted back. */
  id: string
  kind: InstanceKind
  label: string
  commandLine: string | null
  cwd: string | null
  repoRoot: string | null
  repoName: string | null
  origin: Origin
  /** Parent terminal / Claude session is gone but the process keeps running. */
  isOrphan: boolean
  ports: number[]
  pids: number[]
  memoryBytes: number
  cpuPercent: number
  startedAt: number
  /** Details (cwd/env) could not be read, e.g. elevated process. */
  limited: boolean
}

export interface ConsumerView {
  id: string
  name: string
  processCount: number
  memoryBytes: number
  cpuPercent: number
  isProtected: boolean
}

export interface ContainerView {
  id: string
  name: string
  image: string
  ports: string
  status: string
  composeProject: string | null
  workingDir: string | null
}

export interface DockerState {
  available: boolean
  containers: ContainerView[]
}

export interface SystemMemory {
  totalBytes: number
  freeBytes: number
}

export interface Snapshot {
  takenAt: number
  platform: string
  instances: InstanceView[]
  topConsumers: ConsumerView[]
  memory: SystemMemory
}

export interface KillFailure {
  pid: number
  reason:
    | 'not-found'
    | 'identity-changed'
    | 'protected'
    | 'access-denied'
    | 'still-running'
    | 'unknown-id'
}

export interface KillResult {
  killed: number[]
  failed: KillFailure[]
}

export interface ContainerStopResult {
  stopped: string[]
  failed: string[]
}

export interface Settings {
  language: Language | null
  pollIntervalMs: number
  protectedNames: string[]
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not-available' }
  | { status: 'available'; version: string; manualDownloadUrl: string | null }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
