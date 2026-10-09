import { execFile } from 'node:child_process'
import type { ProcessIdentity, TerminateOutcome } from '../types'
import {
  CloseHandle,
  PROCESS_QUERY_LIMITED_INFORMATION,
  PROCESS_TERMINATE,
  SYNCHRONIZE,
  TerminateProcess,
  WAIT_OBJECT_0,
  WaitForSingleObject,
  openProcess,
  type Handle
} from './ffi'
import { enumerateProcesses, readTimes } from './processes'

const GRACEFUL_WAIT_MS = 4000
const FORCED_WAIT_MS = 2000
const POLL_MS = 100

interface OpenTarget {
  pid: number
  handle: Handle
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const hasExited = (handle: Handle): boolean => WaitForSingleObject(handle, 0) === WAIT_OBJECT_0

async function waitForExit(targets: OpenTarget[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && targets.some((t) => !hasExited(t.handle))) await sleep(POLL_MS)
}

/** `taskkill` without /F posts WM_CLOSE so GUI apps can close cleanly. Never /T (follows stale PPIDs). */
function requestClose(pids: number[]): Promise<void> {
  const args = pids.flatMap((pid) => ['/PID', String(pid)])
  return new Promise((resolve) =>
    execFile('taskkill.exe', args, { windowsHide: true }, () => resolve())
  )
}

/**
 * Opens every target first and keeps the handles until the end: an open handle pins the process
 * object, so the PID can't be recycled between the identity check and TerminateProcess.
 */
export async function terminate(
  targets: ProcessIdentity[],
  graceful: boolean
): Promise<Map<number, TerminateOutcome>> {
  const outcomes = new Map<number, TerminateOutcome>()
  const opened: OpenTarget[] = []
  const runningPids = new Set(enumerateProcesses().map((p) => p.pid))

  for (const target of targets) {
    const handle = openProcess(
      target.pid,
      PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE
    )
    if (handle === null) {
      outcomes.set(target.pid, runningPids.has(target.pid) ? 'access-denied' : 'not-found')
    } else if (readTimes(handle)?.startTimeMs !== target.startTimeMs) {
      CloseHandle(handle)
      outcomes.set(target.pid, 'identity-changed')
    } else {
      opened.push({ pid: target.pid, handle })
    }
  }

  try {
    if (graceful && opened.length > 0) {
      await requestClose(opened.map((t) => t.pid))
      await waitForExit(opened, GRACEFUL_WAIT_MS)
    }
    for (const target of opened) {
      if (!hasExited(target.handle)) TerminateProcess(target.handle, 1)
    }
    await waitForExit(opened, FORCED_WAIT_MS)
    for (const target of opened) {
      outcomes.set(target.pid, hasExited(target.handle) ? 'killed' : 'still-running')
    }
  } finally {
    for (const target of opened) CloseHandle(target.handle)
  }
  return outcomes
}
