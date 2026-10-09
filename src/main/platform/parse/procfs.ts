import { commandLineFromArgv } from './argv'

export interface ProcStat {
  pid: number
  /** Kernel name, truncated to 15 bytes and changeable by the process (prctl PR_SET_NAME). */
  comm: string
  state: string
  ppid: number
  utimeTicks: number
  stimeTicks: number
  /** Clock ticks since boot. */
  startTicks: number
  rssPages: number
}

/**
 * `/proc/<pid>/stat`. `comm` sits in parentheses and may itself contain spaces and `)`, so the
 * numeric fields start after the last `)`. Indexes below are the man page field numbers minus 3.
 */
export function parseProcStat(content: string): ProcStat | null {
  const open = content.indexOf('(')
  const close = content.lastIndexOf(')')
  if (open < 0 || close < open) return null
  const fields = content
    .slice(close + 1)
    .trim()
    .split(/\s+/)
  if (fields.length < 22) return null
  const stat: ProcStat = {
    pid: Number(content.slice(0, open)),
    comm: content.slice(open + 1, close),
    state: fields[0],
    ppid: Number(fields[1]),
    utimeTicks: Number(fields[11]),
    stimeTicks: Number(fields[12]),
    startTicks: Number(fields[19]),
    rssPages: Number(fields[21])
  }
  const { pid, ppid, utimeTicks, stimeTicks, startTicks, rssPages } = stat
  const numbers = [pid, ppid, utimeTicks, stimeTicks, startTicks, rssPages]
  return numbers.every(Number.isFinite) ? stat : null
}

/** Zombies and dead tasks are gone for every purpose: no memory, no cwd, nothing to signal. */
export function isDeadState(state: string): boolean {
  return state === 'Z' || state === 'X' || state === 'x'
}

/** `btime` line of `/proc/stat`: boot time in epoch seconds. */
export function parseBootTime(content: string): number | null {
  const match = /^btime\s+(\d+)\s*$/m.exec(content)
  return match === null ? null : Number(match[1])
}

/**
 * `/proc/<pid>/cmdline`: NUL-separated argv. A single chunk is either a plain command or a title
 * that the kernel read past the argv area (setproctitle): both are shown verbatim.
 */
export function parseProcCmdline(raw: string): string | null {
  const args = raw.replace(/\0$/, '').split('\0')
  if (args.length === 1) return args[0] === '' ? null : args[0]
  return commandLineFromArgv(args)
}

export interface ProcSocket {
  address: string
  port: number
  /** Owner of the socket (the uid that created it). */
  uid: number
  inode: string
}

const TCP_LISTEN = '0A'

/** The kernel prints each 32-bit word of the address with %08X in host byte order. */
function addressBytes(hex: string, littleEndian: boolean): Buffer {
  const bytes = Buffer.from(hex, 'hex')
  if (!littleEndian) return bytes
  for (let word = 0; word < bytes.length; word += 4) bytes.subarray(word, word + 4).reverse()
  return bytes
}

function formatAddress(bytes: Buffer): string {
  if (bytes.length === 4) return [...bytes].join('.')
  const groups: string[] = []
  for (let i = 0; i < 16; i += 2) groups.push(bytes.readUInt16BE(i).toString(16))
  // The WHATWG URL parser emits the canonical compressed form (RFC 5952).
  return new URL(`http://[${groups.join(':')}]`).hostname.slice(1, -1)
}

/** LISTEN rows of `/proc/net/tcp` or `/proc/net/tcp6`. */
export function parseProcNetTcp(content: string, littleEndian: boolean): ProcSocket[] {
  const sockets: ProcSocket[] = []
  for (const line of content.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 10 || fields[3] !== TCP_LISTEN || fields[9] === '0') continue
    const [hexAddress, hexPort] = fields[1].split(':')
    if (hexPort === undefined || !/^([0-9A-F]{8}|[0-9A-F]{32})$/i.test(hexAddress)) continue
    sockets.push({
      address: formatAddress(addressBytes(hexAddress, littleEndian)),
      port: Number.parseInt(hexPort, 16),
      uid: Number(fields[7]),
      inode: fields[9]
    })
  }
  return sockets
}

/** `socket:[12345]` (readlink of `/proc/<pid>/fd/<n>`) → `12345`. */
export function socketInode(linkTarget: string): string | null {
  return /^socket:\[(\d+)\]$/.exec(linkTarget)?.[1] ?? null
}
