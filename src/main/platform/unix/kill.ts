import type { ProcessIdentity, TerminateOutcome } from '../types'

/** Start time of a living process (zombies count as gone), null when there is none. */
export type StartTimeReader = (pid: number) => Promise<number | null>

const GRACEFUL_WAIT_MS = 4000
const TERM_WAIT_MS = 1500
const KILL_WAIT_MS = 2000
const POLL_MS = 100

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const errorCode = (error: unknown): unknown => (error as NodeJS.ErrnoException | null)?.code

/**
 * Checks pid + start time right before signalling, so a recycled PID is never hit. Only positive
 * PIDs above init are signalled: 0 and negative values would target whole process groups.
 * Returns null once the signal is delivered.
 */
async function signalSameProcess(
  target: ProcessIdentity,
  signal: NodeJS.Signals,
  startTimeOf: StartTimeReader
): Promise<TerminateOutcome | null> {
  if (!Number.isSafeInteger(target.pid) || target.pid <= 1) return 'access-denied'
  const startTimeMs = await startTimeOf(target.pid)
  if (startTimeMs === null) return 'not-found'
  if (startTimeMs !== target.startTimeMs) return 'identity-changed'
  try {
    process.kill(target.pid, signal)
    return null
  } catch (error) {
    return errorCode(error) === 'ESRCH' ? 'not-found' : 'access-denied'
  }
}

async function stillAlive(
  targets: ProcessIdentity[],
  startTimeOf: StartTimeReader
): Promise<ProcessIdentity[]> {
  const starts = await Promise.all(targets.map((t) => startTimeOf(t.pid)))
  return targets.filter((target, i) => starts[i] === target.startTimeMs)
}

/** Polls until every target is gone or the timeout expires; returns the survivors. */
async function waitForExit(
  targets: ProcessIdentity[],
  timeoutMs: number,
  startTimeOf: StartTimeReader
): Promise<ProcessIdentity[]> {
  const deadline = Date.now() + timeoutMs
  let alive = await stillAlive(targets, startTimeOf)
  while (alive.length > 0 && Date.now() < deadline) {
    await sleep(POLL_MS)
    alive = await stillAlive(alive, startTimeOf)
  }
  return alive
}

/**
 * SIGTERM to every target (callers pass leaves first), a grace period, then SIGKILL to the
 * survivors after verifying their identity again. Never signals process groups.
 */
export async function terminate(
  targets: ProcessIdentity[],
  graceful: boolean,
  startTimeOf: StartTimeReader
): Promise<Map<number, TerminateOutcome>> {
  const outcomes = new Map<number, TerminateOutcome>()
  const terminated: ProcessIdentity[] = []
  for (const target of targets) {
    const refused = await signalSameProcess(target, 'SIGTERM', startTimeOf)
    if (refused === null) terminated.push(target)
    else outcomes.set(target.pid, refused)
  }

  const stubborn = await waitForExit(
    terminated,
    graceful ? GRACEFUL_WAIT_MS : TERM_WAIT_MS,
    startTimeOf
  )
  const killed: ProcessIdentity[] = []
  for (const target of stubborn) {
    const refused = await signalSameProcess(target, 'SIGKILL', startTimeOf)
    if (refused === null) killed.push(target)
    // not-found / identity-changed here means the original process died after the SIGTERM.
    else if (refused === 'access-denied') outcomes.set(target.pid, refused)
  }

  const survivors = new Set(
    (await waitForExit(killed, KILL_WAIT_MS, startTimeOf)).map((t) => t.pid)
  )
  for (const target of terminated) {
    if (!outcomes.has(target.pid)) {
      outcomes.set(target.pid, survivors.has(target.pid) ? 'still-running' : 'killed')
    }
  }
  return outcomes
}
