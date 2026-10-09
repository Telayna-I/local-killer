import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TerminateOutcome } from '../../../src/main/platform/types'
import { terminate } from '../../../src/main/platform/unix/kill'

interface FakeProcess {
  start: number
  /** Signals this process dies from; others are ignored. */
  diesOn: NodeJS.Signals[]
  denied?: boolean
}

/** A tiny process table behind process.kill and the start time reader. */
function fakeOs(table: Map<number, FakeProcess>): {
  signals: [number, string][]
  startTimeOf: (pid: number) => Promise<number | null>
} {
  const signals: [number, string][] = []
  vi.spyOn(process, 'kill').mockImplementation((pid: number, signal?: string | number) => {
    signals.push([pid, String(signal)])
    const target = table.get(pid)
    if (target === undefined) throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
    if (target.denied) throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' })
    if (target.diesOn.includes(signal as NodeJS.Signals)) table.delete(pid)
    return true
  })
  return { signals, startTimeOf: async (pid) => table.get(pid)?.start ?? null }
}

async function run(
  promise: Promise<Map<number, TerminateOutcome>>
): Promise<Map<number, TerminateOutcome>> {
  await vi.advanceTimersByTimeAsync(10_000)
  return promise
}

describe('unix terminate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('verifies identity, escalates to SIGKILL and reports every outcome', async () => {
    const table = new Map<number, FakeProcess>([
      [100, { start: 1000, diesOn: ['SIGTERM'] }],
      [101, { start: 9999, diesOn: ['SIGTERM'] }],
      [102, { start: 1000, diesOn: [], denied: true }],
      [104, { start: 1000, diesOn: ['SIGKILL'] }],
      [105, { start: 1000, diesOn: [] }]
    ])
    const os = fakeOs(table)
    const targets = [100, 101, 102, 103, 104, 105].map((pid) => ({ pid, startTimeMs: 1000 }))

    const outcomes = await run(terminate(targets, false, os.startTimeOf))

    expect(Object.fromEntries(outcomes)).toEqual({
      100: 'killed',
      101: 'identity-changed',
      102: 'access-denied',
      103: 'not-found',
      104: 'killed',
      105: 'still-running'
    })
    expect(os.signals).toEqual([
      [100, 'SIGTERM'],
      [102, 'SIGTERM'],
      [104, 'SIGTERM'],
      [105, 'SIGTERM'],
      [104, 'SIGKILL'],
      [105, 'SIGKILL']
    ])
  })

  it('never sends SIGKILL to a pid recycled during the grace period', async () => {
    const table = new Map<number, FakeProcess>([[200, { start: 1000, diesOn: [] }]])
    const os = fakeOs(table)
    const promise = terminate([{ pid: 200, startTimeMs: 1000 }], true, os.startTimeOf)
    await vi.advanceTimersByTimeAsync(1000)
    table.set(200, { start: 5000, diesOn: ['SIGKILL'] })

    const outcomes = await run(promise)

    expect(outcomes.get(200)).toBe('killed')
    expect(os.signals).toEqual([[200, 'SIGTERM']])
  })

  it('refuses init, process groups and invalid pids without signalling', async () => {
    const os = fakeOs(new Map())
    const targets = [1, 0, -5].map((pid) => ({ pid, startTimeMs: 1 }))

    const outcomes = await run(terminate(targets, false, os.startTimeOf))

    expect([...outcomes.values()]).toEqual(['access-denied', 'access-denied', 'access-denied'])
    expect(os.signals).toEqual([])
  })
})
