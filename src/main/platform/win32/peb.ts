import type { ProcessDetails, ProcessIdentity } from '../types'
import { parseEnvironmentBlock } from '../parse/environment'
import {
  NtQueryInformationProcess,
  PROCESS_QUERY_LIMITED_INFORMATION,
  PROCESS_VM_READ,
  ProcessBasicInformation,
  ProcessWow64Information,
  ReadProcessMemory,
  withProcess,
  type Handle
} from './ffi'
import { readTimes } from './processes'

// x64 layouts, stable since Windows 8 (verified against the 24H2 symbols on vergiliusproject.com).
const PBI_SIZE = 48
const PBI_PEB_ADDRESS = 8
const PEB_PROCESS_PARAMETERS = 0x20n
const PARAMS_READ_SIZE = 0x400
const PARAMS_CWD_LENGTH = 0x38
const PARAMS_CWD_BUFFER = 0x40
const PARAMS_ENVIRONMENT = 0x80
const PARAMS_ENVIRONMENT_SIZE = 0x3f0
const MAX_PATH_BYTES = 32767 * 2
const MAX_ENVIRONMENT_BYTES = 1024 * 1024

function readRemote(handle: Handle, address: bigint, size: number): Buffer | null {
  if (address === 0n || size <= 0) return null
  const buffer = Buffer.alloc(size)
  return ReadProcessMemory(handle, address, buffer, size, null) ? buffer : null
}

function isWow64(handle: Handle): boolean {
  const info = Buffer.alloc(8)
  const status: number = NtQueryInformationProcess(handle, ProcessWow64Information, info, 8, [0])
  return status !== 0 || info.readBigUInt64LE(0) !== 0n
}

function readProcessParameters(handle: Handle): Buffer | null {
  const basicInfo = Buffer.alloc(PBI_SIZE)
  const status: number = NtQueryInformationProcess(
    handle,
    ProcessBasicInformation,
    basicInfo,
    PBI_SIZE,
    [0]
  )
  if (status !== 0) return null
  const pebAddress = basicInfo.readBigUInt64LE(PBI_PEB_ADDRESS)
  const pointer = readRemote(handle, pebAddress + PEB_PROCESS_PARAMETERS, 8)
  if (pointer === null) return null
  return readRemote(handle, pointer.readBigUInt64LE(0), PARAMS_READ_SIZE)
}

function readCwd(handle: Handle, params: Buffer): string | null {
  const length = params.readUInt16LE(PARAMS_CWD_LENGTH)
  if (length === 0 || length > MAX_PATH_BYTES || length % 2 !== 0) return null
  const raw = readRemote(handle, params.readBigUInt64LE(PARAMS_CWD_BUFFER), length)
  return raw === null ? null : raw.toString('utf16le').replace(/\\$/, '')
}

function readEnvironment(handle: Handle, params: Buffer): Record<string, string> | null {
  const size = Number(params.readBigUInt64LE(PARAMS_ENVIRONMENT_SIZE))
  if (size === 0 || size > MAX_ENVIRONMENT_BYTES) return null
  const raw = readRemote(handle, params.readBigUInt64LE(PARAMS_ENVIRONMENT), size)
  return raw === null ? null : parseEnvironmentBlock(raw.toString('utf16le'))
}

/**
 * Reads cwd and environment from the target's PEB. Returns null for unreadable, 32-bit (WOW64)
 * or recycled processes (creation time no longer matches).
 */
export function readProcessDetails(target: ProcessIdentity): ProcessDetails | null {
  return withProcess(target.pid, PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, (handle) => {
    if (readTimes(handle)?.startTimeMs !== target.startTimeMs) return null
    if (isWow64(handle)) return null
    const params = readProcessParameters(handle)
    if (params === null) return null
    return { cwd: readCwd(handle, params), env: readEnvironment(handle, params) }
  })
}
