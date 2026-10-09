import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { ContainerStopResult, ContainerView, DockerState } from '../../shared/types'
import { parseDockerPs } from './parse'

const TIMEOUT_MS = 5000
// GUI apps on macOS don't inherit the shell PATH, so the usual install locations are probed too.
const CANDIDATES: Record<string, string[]> = {
  win32: ['C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe'],
  darwin: [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker'
  ],
  linux: ['/usr/bin/docker', '/usr/local/bin/docker', '/snap/bin/docker']
}

/** Labels are read one by one: `--format json` joins them with commas, which compose paths may contain. */
export const PS_FORMAT = [
  '{{.ID}}',
  '{{.Names}}',
  '{{.Image}}',
  '{{.Ports}}',
  '{{.Status}}',
  '{{.Label "com.docker.compose.project"}}',
  '{{.Label "com.docker.compose.project.working_dir"}}'
].join('\t')

function run(binary: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(binary, args, { timeout: TIMEOUT_MS, windowsHide: true }, (error, stdout) =>
      error ? reject(error) : resolve(stdout)
    )
  )
}

export class DockerService {
  private lastIds = new Set<string>()
  private readonly binary: string

  constructor(platform: string = process.platform) {
    this.binary = (CANDIDATES[platform] ?? []).find((path) => existsSync(path)) ?? 'docker'
  }

  /** Running containers that publish at least one port. Docker not installed/running → unavailable. */
  async list(): Promise<DockerState> {
    try {
      const output = await run(this.binary, ['ps', '--no-trunc', '--format', PS_FORMAT])
      const containers: ContainerView[] = parseDockerPs(output).filter((c) =>
        c.ports.includes('->')
      )
      this.lastIds = new Set(containers.map((c) => c.id))
      return { available: true, containers }
    } catch {
      this.lastIds = new Set()
      return { available: false, containers: [] }
    }
  }

  /** Only ids returned by the last `list()` are accepted. */
  async stop(ids: string[]): Promise<ContainerStopResult> {
    const known = ids.filter((id) => this.lastIds.has(id))
    const unknown = ids.filter((id) => !this.lastIds.has(id))
    if (known.length === 0) return { stopped: [], failed: unknown }
    try {
      const output = await run(this.binary, ['stop', ...known])
      const stopped = output.split(/\r?\n/).filter((line) => known.includes(line.trim()))
      return { stopped, failed: [...unknown, ...known.filter((id) => !stopped.includes(id))] }
    } catch {
      return { stopped: [], failed: ids }
    }
  }
}
