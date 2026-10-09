import {
  VNODE_PATH_INFO_SIZE,
  parseProcArgs2,
  parseVnodePathInfo,
  type ProcArgs
} from '../parse/darwin'

// libSystem bindings through koffi. Every buffer is a Node Buffer passed as `void *`: Electron's
// V8 memory cage forbids external ArrayBuffers, so koffi.view() must never be used.

const CTL_KERN = 1
const KERN_ARGMAX = 8
const KERN_PROCARGS2 = 49
const PROC_PIDVNODEPATHINFO = 9
const PROC_PIDPATHINFO_MAXSIZE = 4096
const DEFAULT_ARGMAX = 1024 * 1024

export interface LibSystem {
  /** proc_pidpath: works for every user's processes. */
  executablePath(pid: number): string | null
  /** KERN_PROCARGS2: argv and environment, own processes only. */
  procArgs(pid: number): ProcArgs | null
  /** PROC_PIDVNODEPATHINFO: own processes only. */
  cwd(pid: number): string | null
}

async function bind(): Promise<LibSystem> {
  const { default: koffi } = await import('koffi')
  const lib = koffi.load('/usr/lib/libSystem.B.dylib')
  const sysctl = lib.func(
    'int sysctl(void *name, uint32 namelen, void *oldp, void *oldlenp, void *newp, size_t newlen)'
  )
  const procPidPath = lib.func('int proc_pidpath(int pid, void *buffer, uint32 buffersize)')
  const procPidInfo = lib.func(
    'int proc_pidinfo(int pid, int flavor, uint64 arg, void *buffer, int buffersize)'
  )

  const mib = Buffer.alloc(3 * 4)
  const length = Buffer.alloc(8)
  /** Fills `out` and returns the number of bytes written, null on error. */
  const readSysctl = (name: number[], out: Buffer): number | null => {
    name.forEach((value, i) => mib.writeInt32LE(value, i * 4))
    length.writeBigUInt64LE(BigInt(out.length))
    const result: number = sysctl(mib, name.length, out, length, null, 0)
    return result === 0 ? Number(length.readBigUInt64LE(0)) : null
  }

  const argMaxValue = Buffer.alloc(4)
  const argMax =
    readSysctl([CTL_KERN, KERN_ARGMAX], argMaxValue) === 4 && argMaxValue.readInt32LE(0) > 0
      ? argMaxValue.readInt32LE(0)
      : DEFAULT_ARGMAX
  const procArgsBuffer = Buffer.alloc(argMax)
  const pathBuffer = Buffer.alloc(PROC_PIDPATHINFO_MAXSIZE)
  const vnodeBuffer = Buffer.alloc(VNODE_PATH_INFO_SIZE)

  return {
    executablePath(pid) {
      const size: number = procPidPath(pid, pathBuffer, pathBuffer.length)
      return size > 0 ? pathBuffer.toString('utf8', 0, size) : null
    },
    procArgs(pid) {
      const size = readSysctl([CTL_KERN, KERN_PROCARGS2, pid], procArgsBuffer)
      return size === null ? null : parseProcArgs2(procArgsBuffer.subarray(0, size))
    },
    cwd(pid) {
      const size: number = procPidInfo(
        pid,
        PROC_PIDVNODEPATHINFO,
        0,
        vnodeBuffer,
        vnodeBuffer.length
      )
      return size === vnodeBuffer.length ? parseVnodePathInfo(vnodeBuffer) : null
    }
  }
}

let binding: Promise<LibSystem | null> | null = null

/** Loaded on first use; null when koffi or libSystem can't be loaded (callers fall back to CLIs). */
export function libSystem(): Promise<LibSystem | null> {
  binding ??= bind().catch((error: unknown) => {
    console.warn('[darwin] libSystem bindings unavailable:', error)
    return null
  })
  return binding
}
