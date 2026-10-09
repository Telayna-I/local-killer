export interface RawProcess {
  pid: number
  ppid: number
  /** Executable base name as reported by the OS, e.g. `node.exe` or `node`. */
  name: string
  /** Epoch ms. 0 when unknown (protected/system processes). Part of the process identity. */
  startTimeMs: number
  /** Cumulative user + kernel CPU time, null when unreadable. */
  cpuTimeMs: number | null
  memoryBytes: number | null
  commandLine: string | null
  executablePath: string | null
  /** Runs in another Windows session than LocalKiller (services, other users) or under another uid. */
  isSystem: boolean
}

export interface RawListener {
  pid: number
  port: number
  address: string
}

export interface ProcessDetails {
  cwd: string | null
  env: Record<string, string> | null
}

export interface ProcessIdentity {
  pid: number
  startTimeMs: number
}

export type TerminateOutcome =
  'killed' | 'not-found' | 'identity-changed' | 'access-denied' | 'still-running'

export interface ProcessProvider {
  listProcesses(): Promise<RawProcess[]>
  listListeners(): Promise<RawListener[]>
  /** cwd + environment of a process; null when the process can't be read at all. */
  getDetails(target: ProcessIdentity): Promise<ProcessDetails | null>
  /**
   * Terminates the given processes in order (callers pass leaves first).
   * `graceful` asks the app to close (WM_CLOSE / SIGTERM) before forcing.
   */
  terminate(targets: ProcessIdentity[], graceful: boolean): Promise<Map<number, TerminateOutcome>>
}
