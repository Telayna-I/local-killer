import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { KillService } from '../../src/main/core/kill-service'
import { DEFAULT_PROTECTED_NAMES } from '../../src/main/core/protect'
import { SnapshotService } from '../../src/main/core/snapshot'
import { getProvider } from '../../src/main/platform'
import type { InstanceView } from '../../src/shared/types'

const SERVER = `const s = require('http').createServer((q, r) => r.end('ok')); s.listen(0, () => process.stdout.write(s.address().port + '\\n'))`
const WATCHER = `setInterval(() => {}, 1000)`
// Launches the watcher detached and exits, so the watcher's parent is gone: a real orphan.
const ORPHAN_LAUNCHER = `const c = require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(WATCHER)}], { detached: true, stdio: 'ignore' }); require('fs').writeFileSync('orphan.pid', String(c.pid)); c.unref()`

/** The test runner itself may run inside Claude Code: children get an explicit environment. */
function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const inherited = Object.entries(process.env).filter(
    ([key]) =>
      !/^(CLAUDE|AI_AGENT|TERM_PROGRAM|WT_SESSION|TERMINAL_EMULATOR|VSCODE|CURSOR)/i.test(key)
  )
  return { ...Object.fromEntries(inherited), ...extra }
}

/** Raw provider view of some processes and their parents, attached to assertion failures (CI). */
async function describeProcesses(pids: (number | undefined)[]): Promise<string> {
  const processes = await (await getProvider()).listProcesses()
  const byPid = new Map(processes.map((p) => [p.pid, p]))
  const rows = pids.flatMap((pid) => {
    const self = pid === undefined ? undefined : byPid.get(pid)
    const parent = self === undefined ? undefined : byPid.get(self.ppid)
    return [self, parent].map((p) =>
      p === undefined
        ? 'missing'
        : `${p.pid}<-${p.ppid} ${p.name} start=${p.startTimeMs} system=${p.isSystem}`
    )
  })
  return `diagnostics: ${rows.join(' | ')}`
}

const samePath = (a: string | null, b: string): boolean =>
  process.platform === 'win32' ? a?.toLowerCase() === b.toLowerCase() : a === b

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' })
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
}

async function waitFor<T>(
  probe: () => Promise<T | undefined> | T | undefined,
  timeoutMs = 10_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await probe()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 200))
  }
}

describe('detect and kill on the real OS', () => {
  let repo: string
  let server: ChildProcess
  let port: number
  let snapshots: SnapshotService
  let killer: KillService

  beforeAll(async () => {
    repo = realpathSync.native(mkdtempSync(join(tmpdir(), 'localkiller-')))
    mkdirSync(join(repo, '.git'))
    const provider = await getProvider()
    const settings = {
      language: null,
      pollIntervalMs: 3000,
      protectedNames: DEFAULT_PROTECTED_NAMES
    }
    snapshots = new SnapshotService(provider, () => settings)
    killer = new KillService(provider, snapshots)

    server = spawn(process.execPath, ['-e', SERVER], {
      cwd: repo,
      env: cleanEnv({ CLAUDE_CODE_CHILD_SESSION: '1' })
    })
    port = await new Promise<number>((resolve) =>
      server.stdout?.once('data', (chunk: Buffer) =>
        resolve(Number(chunk.toString().split('\n')[0]))
      )
    )
  })

  afterAll(() => {
    server?.kill()
    // A failed test may leave a process holding the directory; cleanup is best effort.
    rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  })

  it('finds the listening server with its repo, port and Claude Code origin, then kills it', async () => {
    const instance = await waitFor(async () =>
      (await snapshots.take()).instances.find((i: InstanceView) => i.ports.includes(port))
    )
    expect(instance, await describeProcesses([server.pid, process.pid])).toMatchObject({
      kind: 'dev',
      origin: 'claude-code',
      isOrphan: false
    })
    expect(samePath(instance.repoRoot, repo)).toBe(true)
    expect(instance.pids).toContain(server.pid)

    const result = await killer.killInstances([instance.id])

    expect(result.killed).toContain(server.pid)
    expect(await portIsOpen(port)).toBe(false)
  })

  it('finds an orphaned watcher without ports and kills it', async () => {
    const launcher = spawn(process.execPath, ['-e', ORPHAN_LAUNCHER], {
      cwd: repo,
      env: cleanEnv({})
    })
    await new Promise((resolve) => launcher.once('exit', resolve))
    const orphanPid = Number(readFileSync(join(repo, 'orphan.pid'), 'utf8'))

    const instance = await waitFor(async () =>
      (await snapshots.take()).instances.find((i) => i.pids.includes(orphanPid))
    )
    expect(instance).toMatchObject({ kind: 'dev', isOrphan: true, ports: [] })
    expect(samePath(instance.repoRoot, repo)).toBe(true)

    const result = await killer.killInstances([instance.id])

    expect(result.killed).toEqual([orphanPid])
    const gone = await waitFor(async () => {
      const snapshot = await snapshots.take()
      return snapshot.instances.some((i) => i.pids.includes(orphanPid)) ? undefined : true
    })
    expect(gone).toBe(true)
    expect(existsSync(repo)).toBe(true)
  })
})
