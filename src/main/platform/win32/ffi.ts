import koffi from 'koffi'

// Win32 bindings. Every buffer is a Node Buffer passed as `void *`: Electron's V8 memory cage
// forbids external ArrayBuffers, so koffi.view() must never be used.

const kernel32 = koffi.load('kernel32.dll')
const ntdll = koffi.load('ntdll.dll')
const iphlpapi = koffi.load('iphlpapi.dll')

export const TH32CS_SNAPPROCESS = 0x2
export const PROCESS_TERMINATE = 0x1
export const PROCESS_VM_READ = 0x10
export const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
export const SYNCHRONIZE = 0x100000
export const WAIT_OBJECT_0 = 0
export const AF_INET = 2
export const AF_INET6 = 23
export const TCP_TABLE_OWNER_PID_LISTENER = 3
export const ProcessBasicInformation = 0
export const ProcessWow64Information = 26
export const ProcessCommandLineInformation = 60
export const STATUS_INFO_LENGTH_MISMATCH = 0xc0000004 | 0

export const PROCESSENTRY32W = koffi.struct('PROCESSENTRY32W', {
  dwSize: 'uint32',
  cntUsage: 'uint32',
  th32ProcessID: 'uint32',
  th32DefaultHeapID: 'uintptr_t',
  th32ModuleID: 'uint32',
  cntThreads: 'uint32',
  th32ParentProcessID: 'uint32',
  pcPriClassBase: 'int32',
  dwFlags: 'uint32',
  szExeFile: koffi.array('char16_t', 260, 'String')
})

export interface ProcessEntry32 {
  dwSize: number
  th32ProcessID: number
  th32ParentProcessID: number
  szExeFile: string
}

koffi.pointer('HANDLE', koffi.opaque())

export const CreateToolhelp32Snapshot = kernel32.func(
  'HANDLE __stdcall CreateToolhelp32Snapshot(uint32 dwFlags, uint32 th32ProcessID)'
)
export const Process32FirstW = kernel32.func(
  'bool __stdcall Process32FirstW(HANDLE hSnapshot, _Inout_ PROCESSENTRY32W *lppe)'
)
export const Process32NextW = kernel32.func(
  'bool __stdcall Process32NextW(HANDLE hSnapshot, _Inout_ PROCESSENTRY32W *lppe)'
)
export const OpenProcess = kernel32.func(
  'HANDLE __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'
)
export const CloseHandle = kernel32.func('bool __stdcall CloseHandle(HANDLE hObject)')
export const GetProcessTimes = kernel32.func(
  'bool __stdcall GetProcessTimes(HANDLE hProcess, _Out_ uint64 *creation, _Out_ uint64 *exit, _Out_ uint64 *kernel, _Out_ uint64 *user)'
)
export const K32GetProcessMemoryInfo = kernel32.func(
  'bool __stdcall K32GetProcessMemoryInfo(HANDLE hProcess, void *counters, uint32 cb)'
)
export const ReadProcessMemory = kernel32.func(
  'bool __stdcall ReadProcessMemory(HANDLE hProcess, uint64 lpBaseAddress, void *lpBuffer, size_t nSize, void *lpNumberOfBytesRead)'
)
export const ProcessIdToSessionId = kernel32.func(
  'bool __stdcall ProcessIdToSessionId(uint32 dwProcessId, _Out_ uint32 *pSessionId)'
)
export const TerminateProcess = kernel32.func(
  'bool __stdcall TerminateProcess(HANDLE hProcess, uint32 uExitCode)'
)
export const GetExitCodeProcess = kernel32.func(
  'bool __stdcall GetExitCodeProcess(HANDLE hProcess, _Out_ uint32 *lpExitCode)'
)
export const WaitForSingleObject = kernel32.func(
  'uint32 __stdcall WaitForSingleObject(HANDLE hHandle, uint32 dwMilliseconds)'
)
export const NtQueryInformationProcess = ntdll.func(
  'int32 __stdcall NtQueryInformationProcess(HANDLE ProcessHandle, uint32 ProcessInformationClass, void *ProcessInformation, uint32 ProcessInformationLength, _Out_ uint32 *ReturnLength)'
)
export const GetExtendedTcpTable = iphlpapi.func(
  'uint32 __stdcall GetExtendedTcpTable(void *pTcpTable, _Inout_ uint32 *pdwSize, bool bOrder, uint32 ulAf, uint32 TableClass, uint32 Reserved)'
)

/** Opaque HANDLE as returned by koffi 3 (a BigInt); null means NULL. */
export type Handle = bigint

const INVALID_HANDLE_VALUE = 0xffffffffffffffffn

export function openProcess(pid: number, access: number): Handle | null {
  const handle: Handle | null = OpenProcess(access, false, pid)
  return handle === null || handle === 0n || handle === INVALID_HANDLE_VALUE ? null : handle
}

/** Runs `action` with an open process handle and always closes it. */
export function withProcess<T>(
  pid: number,
  access: number,
  action: (handle: Handle) => T
): T | null {
  const handle = openProcess(pid, access)
  if (handle === null) return null
  try {
    return action(handle)
  } finally {
    CloseHandle(handle)
  }
}

export function createProcessSnapshot(): Handle | null {
  const handle: Handle | null = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
  return handle === null || handle === INVALID_HANDLE_VALUE ? null : handle
}
