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

export class ProtectionPolicy {
  private readonly names: Set<string>

  constructor(
    protectedNames: string[],
    private readonly selfPids: Set<number>
  ) {
    this.names = new Set(protectedNames.map(baseName))
  }

  isProtected(process: RawProcess): boolean {
    return (
      process.isSystem || this.selfPids.has(process.pid) || this.names.has(baseName(process.name))
    )
  }
}
