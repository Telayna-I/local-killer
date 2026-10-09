import type { RawProcess } from '../types'
import {
  CloseHandle,
  GetProcessTimes,
  K32GetProcessMemoryInfo,
  NtQueryInformationProcess,
  PROCESS_QUERY_LIMITED_INFORMATION,
  PROCESSENTRY32W,
  Process32FirstW,
  Process32NextW,
  ProcessCommandLineInformation,
  ProcessIdToSessionId,
  STATUS_INFO_LENGTH_MISMATCH,
  createProcessSnapshot,
  withProcess,
  type Handle,
  type ProcessEntry32
} from './ffi'
import koffi from 'koffi'

const FILETIME_TO_UNIX_EPOCH_MS = 11644473600000
const PROCESS_MEMORY_COUNTERS_SIZE = 72
const WORKING_SET_OFFSET = 16
const UNICODE_STRING_HEADER_SIZE = 16
const MAX_COMMAND_LINE_BYTES = 64 * 1024

const memoryCounters = Buffer.alloc(PROCESS_MEMORY_COUNTERS_SIZE)
const commandLineCache = new Map<string, string | null>()

interface ProcessEntry {
  pid: number
  ppid: number
  name: string
}

/** Toolhelp32 process list: pid, parent pid and exe name, ~3ms for 300 processes. */
export function enumerateProcesses(): ProcessEntry[] {
  const snapshot = createProcessSnapshot()
  if (snapshot === null) return []
  const entries: ProcessEntry[] = []
  try {
    const entry: Partial<ProcessEntry32> = { dwSize: koffi.sizeof(PROCESSENTRY32W) }
    let ok: boolean = Process32FirstW(snapshot, entry)
    while (ok) {
      const { th32ProcessID, th32ParentProcessID, szExeFile } = entry as ProcessEntry32
      entries.push({ pid: th32ProcessID, ppid: th32ParentProcessID, name: szExeFile })
      ok = Process32NextW(snapshot, entry)
    }
  } finally {
    CloseHandle(snapshot)
  }
  return entries
}

export function filetimeToEpochMs(filetime: number | bigint): number {
  return Number(BigInt(filetime) / 10000n) - FILETIME_TO_UNIX_EPOCH_MS
}

export function readTimes(handle: Handle): { startTimeMs: number; cpuTimeMs: number } | null {
  const creation = [0n]
  const exit = [0n]
  const kernel = [0n]
  const user = [0n]
  if (!GetProcessTimes(handle, creation, exit, kernel, user)) return null
  return {
    startTimeMs: filetimeToEpochMs(creation[0]),
    cpuTimeMs: Number((BigInt(kernel[0]) + BigInt(user[0])) / 10000n)
  }
}

function readWorkingSet(handle: Handle): number | null {
  if (!K32GetProcessMemoryInfo(handle, memoryCounters, PROCESS_MEMORY_COUNTERS_SIZE)) return null
  return Number(memoryCounters.readBigUInt64LE(WORKING_SET_OFFSET))
}

/** ProcessCommandLineInformation returns a UNICODE_STRING immediately followed by its characters. */
function readCommandLine(handle: Handle): string | null {
  const returnLength = [0]
  let buffer = Buffer.alloc(1024)
  let status: number = NtQueryInformationProcess(
    handle,
    ProcessCommandLineInformation,
    buffer,
    buffer.length,
    returnLength
  )
  if (status === STATUS_INFO_LENGTH_MISMATCH && returnLength[0] <= MAX_COMMAND_LINE_BYTES) {
    buffer = Buffer.alloc(returnLength[0])
    status = NtQueryInformationProcess(
      handle,
      ProcessCommandLineInformation,
      buffer,
      buffer.length,
      returnLength
    )
  }
  if (status !== 0) return null
  const length = buffer.readUInt16LE(0)
  if (UNICODE_STRING_HEADER_SIZE + length > buffer.length) return null
  return buffer.toString('utf16le', UNICODE_STRING_HEADER_SIZE, UNICODE_STRING_HEADER_SIZE + length)
}

function isServiceSession(pid: number): boolean {
  const session = [0]
  // Unreadable session means a protected system process.
  return !ProcessIdToSessionId(pid, session) || session[0] === 0
}

export function listProcesses(): RawProcess[] {
  const seen = new Set<string>()
  const processes = enumerateProcesses().map((entry): RawProcess => {
    const info = withProcess(entry.pid, PROCESS_QUERY_LIMITED_INFORMATION, (handle) => {
      const times = readTimes(handle)
      const key = `${entry.pid}-${times?.startTimeMs ?? 0}`
      seen.add(key)
      if (!commandLineCache.has(key)) commandLineCache.set(key, readCommandLine(handle))
      return {
        times,
        memoryBytes: readWorkingSet(handle),
        commandLine: commandLineCache.get(key) ?? null
      }
    })
    return {
      pid: entry.pid,
      ppid: entry.ppid,
      name: entry.name,
      startTimeMs: info?.times?.startTimeMs ?? 0,
      cpuTimeMs: info?.times?.cpuTimeMs ?? null,
      memoryBytes: info?.memoryBytes ?? null,
      commandLine: info?.commandLine ?? null,
      executablePath: null,
      isSystem: isServiceSession(entry.pid)
    }
  })
  for (const key of commandLineCache.keys()) if (!seen.has(key)) commandLineCache.delete(key)
  return processes
}
