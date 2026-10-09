import { posix } from 'node:path'
import type { RawListener } from '../types'
import { parseEnvironmentBlock } from './environment'

// Parsers for the BSD tools of macOS, always run with LC_ALL=C and TZ=UTC, and for the raw
// buffers returned by libproc / sysctl. Pure functions: unit tested on every OS.

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
}

/** strftime `%c` in the C locale: `Fri Oct  9 10:21:58 2026` (day padded with a space). */
const LSTART = '[A-Z][a-z]{2} +[A-Z][a-z]{2} +\\d{1,2} \\d{2}:\\d{2}:\\d{2} \\d{4}'

/** `ps -o lstart` printed with TZ=UTC → epoch ms (whole seconds: ps has no finer resolution). */
export function parseLstart(text: string): number | null {
  const match = /^[A-Z][a-z]{2} +([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/.exec(
    text.trim()
  )
  if (match === null) return null
  const [, month, day, hours, minutes, seconds, year] = match
  if (!(month in MONTHS)) return null
  return Date.UTC(
    Number(year),
    MONTHS[month],
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds)
  )
}

/** `ps -o time`: `0:00.03`, `123:45.67` on macOS; `[dd-][hh:]mm:ss` elsewhere. */
export function parseCpuTime(text: string): number | null {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/.exec(text)
  if (match === null) return null
  const [, days = '0', hours = '0', minutes, seconds, fraction = '0'] = match
  const totalSeconds = ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60
  return (totalSeconds + Number(seconds)) * 1000 + Math.round(Number(`0.${fraction}`) * 1000)
}

export interface PsProcess {
  pid: number
  ppid: number
  uid: number
  rssKb: number | null
  cpuTimeMs: number | null
  state: string
  startTimeMs: number
  args: string
}

/** Columns of {@link parsePsProcesses}; `args` must stay last (it may contain spaces). */
export const PS_PROCESS_COLUMNS = 'pid=,ppid=,uid=,rss=,time=,stat=,lstart=,args='

const PS_PROCESS_ROW = new RegExp(
  `^\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(${LSTART})\\s*(.*)$`
)

const numberOrNull = (text: string): number | null => (/^\d+$/.test(text) ? Number(text) : null)

export function parsePsProcesses(output: string): PsProcess[] {
  const processes: PsProcess[] = []
  for (const line of output.split('\n')) {
    const match = PS_PROCESS_ROW.exec(line)
    if (match === null) continue
    const [, pid, ppid, uid, rss, time, state, lstart, args] = match
    const startTimeMs = parseLstart(lstart)
    if (startTimeMs === null) continue
    processes.push({
      pid: Number(pid),
      ppid: Number(ppid),
      uid: Number(uid),
      rssKb: numberOrNull(rss),
      cpuTimeMs: parseCpuTime(time),
      state,
      startTimeMs,
      args: args.trimEnd()
    })
  }
  return processes
}

/** Columns of {@link parsePsStartTimes}. */
export const PS_START_COLUMNS = 'pid=,stat=,lstart='

const PS_START_ROW = new RegExp(`^\\s*(\\d+)\\s+(\\S+)\\s+(${LSTART})\\s*$`)

/** pid → start time of each living process; zombies count as gone. */
export function parsePsStartTimes(output: string): Map<number, number> {
  const times = new Map<number, number>()
  for (const line of output.split('\n')) {
    const match = PS_START_ROW.exec(line)
    if (match === null || match[2].startsWith('Z')) continue
    const startTimeMs = parseLstart(match[3])
    if (startTimeMs !== null) times.set(Number(match[1]), startTimeMs)
  }
  return times
}

/** ps prints `(comm)` when it can't read a process' arguments. */
const UNREADABLE_ARGS = /^\((.+)\)$/

export function commandLineFromPsArgs(args: string): string | null {
  return args === '' || UNREADABLE_ARGS.test(args) ? null : args
}

/** Executable name when its path is unknown: `(comm)`, else argv[0] (`-zsh` is a login shell). */
export function nameFromPsArgs(args: string): string {
  const unreadable = UNREADABLE_ARGS.exec(args)
  if (unreadable !== null) return unreadable[1]
  return posix.basename(args.split(' ')[0].replace(/^-/, ''))
}

/**
 * `lsof -F ptn` output: `p<pid>` starts a process, `f<fd>` a file, then `t<IPv4|IPv6>` and
 * `n<address>:<port>` (`*:3000`, `127.0.0.1:5173`, `[::1]:5173`).
 */
export function parseLsofListeners(output: string): RawListener[] {
  const listeners: RawListener[] = []
  let pid = 0
  let type = ''
  let name = ''
  const flush = (): void => {
    const match = /^(.*):(\d+)$/.exec(name.split('->')[0])
    if (pid > 0 && match !== null) {
      const host = match[1].replace(/^\[(.*)\]$/, '$1')
      const address = host === '*' ? (type === 'IPv6' ? '::' : '0.0.0.0') : host
      listeners.push({ pid, port: Number(match[2]), address })
    }
    type = ''
    name = ''
  }
  for (const line of output.split('\n')) {
    const field = line[0]
    const value = line.slice(1).trim()
    // A file set ends at the next process, the next `f`, or a field repeating while one is pending.
    if (field === 'p' || field === 'f' || ((field === 't' || field === 'n') && name !== '')) {
      flush()
    }
    if (field === 'p') pid = Number(value) || 0
    else if (field === 't') type = value
    else if (field === 'n') name = value
  }
  flush()
  return listeners
}

/** `lsof -a -p <pid> -d cwd -Fn` → the first name field. */
export function parseLsofCwd(output: string): string | null {
  const line = output.split('\n').find((l) => l.startsWith('n/'))
  return line === undefined ? null : line.slice(1)
}

export interface ProcArgs {
  executablePath: string
  argv: string[]
  env: Record<string, string>
}

/**
 * sysctl KERN_PROCARGS2: `int argc`, the exec path, NUL padding, argc NUL-terminated argv strings,
 * then the environment until an empty string (Apple's own strings may follow it).
 */
export function parseProcArgs2(data: Buffer): ProcArgs | null {
  if (data.length < 4) return null
  const argc = data.readInt32LE(0)
  const pathEnd = data.indexOf(0, 4)
  if (argc < 0 || pathEnd < 0) return null
  const executablePath = data.toString('utf8', 4, pathEnd)
  let offset = pathEnd
  while (offset < data.length && data[offset] === 0) offset++
  const argv: string[] = []
  while (argv.length < argc && offset < data.length) {
    const end = data.indexOf(0, offset)
    const stop = end < 0 ? data.length : end
    argv.push(data.toString('utf8', offset, stop))
    offset = stop + 1
  }
  const env = offset < data.length ? parseEnvironmentBlock(data.toString('utf8', offset)) : {}
  return { executablePath, argv, env }
}

/** struct vnode_info: vinfo_stat (136 bytes), vi_type, vi_pad, fsid_t. */
const VNODE_INFO_SIZE = 152
const MAXPATHLEN = 1024
/** struct proc_vnodepathinfo: { vnode_info, char path[MAXPATHLEN] } for the cwd, then the root dir. */
export const VNODE_PATH_INFO_SIZE = 2 * (VNODE_INFO_SIZE + MAXPATHLEN)

/** cwd from a `proc_pidinfo(PROC_PIDVNODEPATHINFO)` buffer. */
export function parseVnodePathInfo(data: Buffer): string | null {
  if (data.length < VNODE_PATH_INFO_SIZE) return null
  const path = data.subarray(VNODE_INFO_SIZE, VNODE_INFO_SIZE + MAXPATHLEN)
  const end = path.indexOf(0)
  const cwd = path.toString('utf8', 0, end < 0 ? MAXPATHLEN : end)
  return cwd === '' ? null : cwd
}
