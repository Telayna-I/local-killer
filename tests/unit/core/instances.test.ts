import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildInstances } from '../../../src/main/core/instances'
import { ProtectionPolicy } from '../../../src/main/core/protect'
import { RepoResolver } from '../../../src/main/core/repo-root'
import { ProcessTree, identityKey } from '../../../src/main/core/tree'
import type { InstanceView } from '../../../src/shared/types'
import type { ProcessDetails, RawListener, RawProcess } from '../../../src/main/platform/types'
import { proc } from '../fixtures'

const REPO = resolve('/work/shop')
const repos = new RepoResolver((path) => path === join(REPO, '.git'), resolve('/home/me'))

function build(
  processes: RawProcess[],
  listeners: RawListener[],
  details: [RawProcess, ProcessDetails][] = [],
  protectedNames: string[] = ['claude', 'mysqld']
): InstanceView[] {
  return buildInstances({
    tree: new ProcessTree(processes),
    listeners,
    details: new Map(details.map(([p, d]) => [identityKey(p), d])),
    cpu: new Map(),
    policy: new ProtectionPolicy(protectedNames, new Set()),
    repos
  }).map((r) => r.view)
}

describe('buildInstances', () => {
  it('groups `cmd /c npm run dev` and its children into one instance rooted at the cmd', () => {
    const terminal = proc({ pid: 100, name: 'pwsh.exe', commandLine: 'pwsh', startTimeMs: 1 })
    const cmd = proc({
      pid: 2,
      ppid: 100,
      name: 'cmd.exe',
      commandLine: 'cmd.exe /d /s /c "npm run dev"'
    })
    const npm = proc({
      pid: 3,
      ppid: 2,
      name: 'node.exe',
      commandLine: 'node C:\\n\\node_modules\\npm\\bin\\npm-cli.js run dev'
    })
    const vite = proc({
      pid: 4,
      ppid: 3,
      name: 'node.exe',
      commandLine: 'node C:\\p\\node_modules\\vite\\bin\\vite.js'
    })
    const [instance] = build(
      [terminal, cmd, npm, vite],
      [{ pid: 4, port: 5173, address: '::1' }],
      [[vite, { cwd: REPO, env: { WT_SESSION: 'x' } }]]
    )

    expect(instance).toMatchObject({
      id: identityKey(cmd),
      kind: 'dev',
      label: 'vite',
      repoName: 'shop',
      origin: 'terminal',
      isOrphan: false,
      ports: [5173]
    })
    expect(instance.pids).toEqual([4, 3, 2])
  })

  it('flags a dev server whose terminal is gone as orphan', () => {
    const vite = proc({ pid: 4, ppid: 99, name: 'node.exe', commandLine: 'node vite.js' })
    const [instance] = build(
      [vite],
      [{ pid: 4, port: 5173, address: '::1' }],
      [[vite, { cwd: REPO, env: {} }]]
    )

    expect(instance.isOrphan).toBe(true)
  })

  it('finds orphan dev processes without ports when they live in a repo', () => {
    const watcher = proc({ pid: 5, ppid: 99, name: 'node.exe', commandLine: 'node tsc --watch' })
    const [instance] = build([watcher], [], [[watcher, { cwd: join(REPO, 'src'), env: {} }]])

    expect(instance).toMatchObject({ kind: 'dev', isOrphan: true, ports: [], repoRoot: REPO })
  })

  it('ignores orphan runtimes outside any repo unless Claude launched them', () => {
    const helper = proc({ pid: 5, ppid: 99, name: 'node.exe' })
    const mcp = proc({ pid: 6, ppid: 98, name: 'node.exe' })
    const instances = build(
      [helper, mcp],
      [],
      [
        [helper, { cwd: resolve('/opt/app'), env: {} }],
        [mcp, { cwd: resolve('/tmp'), env: { CLAUDE_CODE_CHILD_SESSION: '1' } }]
      ]
    )

    expect(instances.map((i) => i.pids)).toEqual([[6]])
  })

  it('marks a process as orphan when its Claude session (CLAUDE_PID) is gone', () => {
    const bash = proc({ pid: 10, name: 'bash.exe', commandLine: 'bash' })
    const server = proc({ pid: 11, ppid: 10, name: 'node.exe' })
    const [instance] = build(
      [bash, server],
      [{ pid: 11, port: 3000, address: '0.0.0.0' }],
      [[server, { cwd: REPO, env: { CLAUDE_PID: '777', CLAUDE_CODE_CHILD_SESSION: '1' } }]]
    )

    expect(instance).toMatchObject({ origin: 'claude-code', isOrphan: true })
  })

  it('stops climbing at Claude itself and at protected processes', () => {
    const claude = proc({ pid: 20, name: 'claude.exe' })
    const shell = proc({
      pid: 21,
      ppid: 20,
      name: 'bash.exe',
      commandLine: 'bash -c "npm run dev"'
    })
    const server = proc({ pid: 22, ppid: 21, name: 'node.exe' })
    const [instance] = build([claude, shell, server], [{ pid: 22, port: 3000, address: '::' }])

    expect(instance.id).toBe(identityKey(shell))
    expect(instance.origin).toBe('claude-code')
    expect(instance.isOrphan).toBe(false)
  })

  it('reports protected listeners as protected and other apps as other', () => {
    const mysql = proc({ pid: 30, name: 'mysqld.exe' })
    const discord = proc({ pid: 31, name: 'Discord.exe' })
    const instances = build(
      [mysql, discord],
      [
        { pid: 30, port: 3306, address: '0.0.0.0' },
        { pid: 31, port: 6463, address: '127.0.0.1' }
      ]
    )

    expect(instances.map((i) => [i.label, i.kind])).toEqual([
      ['discord', 'other'],
      ['mysqld', 'protected']
    ])
  })
})

describe('buildInstances with an interactive -NoExit terminal', () => {
  it('never makes the user terminal the instance root', () => {
    const terminal = proc({
      pid: 200,
      name: 'pwsh.exe',
      commandLine: 'pwsh -NoExit -Command ". init.ps1"',
      startTimeMs: 1
    })
    const server = proc({ pid: 201, ppid: 200, name: 'node.exe' })
    const [instance] = build(
      [terminal, server],
      [{ pid: 201, port: 5173, address: '::1' }],
      [[server, { cwd: REPO, env: {} }]]
    )

    expect(instance.id).toBe(identityKey(server))
    expect(instance.pids).toEqual([201])
  })
})

describe('buildInstances with a listening ancestor', () => {
  const service = proc({ pid: 300, name: 'agent.exe', startTimeMs: 1 })
  const ide = proc({ pid: 400, name: 'Code.exe', startTimeMs: 1 })

  it('does not let a protected listener swallow the dev servers below it', () => {
    const runner = proc({ pid: 301, ppid: 300, name: 'Runner.Worker.exe', startTimeMs: 2 })
    const server = proc({ pid: 302, ppid: 301, name: 'node.exe', startTimeMs: 3 })
    const instances = build(
      [service, runner, server],
      [
        { pid: 300, port: 7000, address: '0.0.0.0' },
        { pid: 302, port: 5173, address: '::' }
      ],
      [[server, { cwd: REPO, env: {} }]],
      ['agent']
    )

    const dev = instances.find((i) => i.pids.includes(302))
    expect(dev).toMatchObject({ kind: 'dev', id: identityKey(server), ports: [5173] })
    expect(instances.find((i) => i.kind === 'protected')?.pids).not.toContain(302)
  })

  it('keeps a terminal opened inside an IDE out of the IDE instance', () => {
    const terminal = proc({
      pid: 401,
      ppid: 400,
      name: 'pwsh.exe',
      commandLine: 'pwsh',
      startTimeMs: 2
    })
    const server = proc({ pid: 402, ppid: 401, name: 'node.exe', startTimeMs: 3 })
    const instances = build(
      [ide, terminal, server],
      [
        { pid: 400, port: 9229, address: '127.0.0.1' },
        { pid: 402, port: 3000, address: '::' }
      ],
      [[server, { cwd: REPO, env: {} }]]
    )

    expect(instances.find((i) => i.id === identityKey(ide))?.pids).toEqual([400])
    expect(instances.find((i) => i.id === identityKey(server))?.pids).toEqual([402])
  })
})
