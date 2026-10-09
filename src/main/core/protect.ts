import type { RawProcess } from '../platform/types'
import { baseName } from './classify'

/** Defaults for Settings.protectedNames: OS core, local databases/servers, Docker, AI sessions. */
export const DEFAULT_PROTECTED_NAMES = [
  'system',
  'registry',
  'smss',
  'csrss',
  'wininit',
  'winlogon',
  'services',
  'lsass',
  'svchost',
  'explorer',
  'dwm',
  'memory compression',
  'launchd',
  'kernel_task',
  'windowserver',
  'loginwindow',
  'systemd',
  'init',
  'mysqld',
  'mariadbd',
  'postgres',
  'redis-server',
  'memurai',
  'mongod',
  'httpd',
  'laragon',
  'xampp-control',
  'com.docker.backend',
  'com.docker.build',
  'docker desktop',
  'dockerd',
  'vpnkit',
  'wslrelay',
  'wslhost',
  'vmmem',
  'claude'
]

/**
 * Entries match process names without extension, case-insensitively. A trailing `*` makes the entry a
 * prefix: `localkiller helper*` covers Electron's macOS helpers (`LocalKiller Helper (GPU)`...).
 */
export class ProtectionPolicy {
  private readonly names = new Set<string>()
  private readonly prefixes: string[] = []

  constructor(
    protectedNames: string[],
    private readonly selfPids: Set<number>
  ) {
    for (const entry of protectedNames.map(baseName)) {
      if (entry.endsWith('*')) this.prefixes.push(entry.slice(0, -1))
      else this.names.add(entry)
    }
  }

  isProtected(process: RawProcess): boolean {
    if (process.isSystem || this.selfPids.has(process.pid)) return true
    const name = baseName(process.name)
    return this.names.has(name) || this.prefixes.some((prefix) => name.startsWith(prefix))
  }
}

/** The app's own executable plus its Electron helpers (separate binaries on macOS). */
export function selfProtectedNames(executableName: string): string[] {
  const name = baseName(executableName)
  return [name, `${name} helper*`]
}
