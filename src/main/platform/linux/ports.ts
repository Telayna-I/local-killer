import { readFileSync, readdirSync, readlinkSync } from 'node:fs'
import { endianness } from 'node:os'
import type { RawListener } from '../types'
import { parseProcNetTcp, socketInode, type ProcSocket } from '../parse/procfs'

interface SocketOwner {
  pid: number
  fd: string
}

/** inode → fd that held it last time: re-checked with one readlink instead of a full fd scan. */
const owners = new Map<string, SocketOwner>()

function readSockets(path: string): ProcSocket[] {
  try {
    return parseProcNetTcp(readFileSync(path, 'utf8'), endianness() === 'LE')
  } catch {
    return []
  }
}

function readLink(path: string): string | null {
  try {
    return readlinkSync(path)
  } catch {
    return null
  }
}

function listDir(path: string): string[] {
  try {
    return readdirSync(path)
  } catch {
    return []
  }
}

/** Walks /proc/<pid>/fd of every readable process until all wanted inodes are found. */
function scanFileDescriptors(wanted: Set<string>, found: Map<string, number>): void {
  for (const entry of listDir('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    for (const fd of listDir(`/proc/${entry}/fd`)) {
      const link = readLink(`/proc/${entry}/fd/${fd}`)
      const inode = link === null ? null : socketInode(link)
      if (inode === null || !wanted.has(inode) || found.has(inode)) continue
      found.set(inode, Number(entry))
      owners.set(inode, { pid: Number(entry), fd })
    }
    if (found.size === wanted.size) return
  }
}

function resolveOwners(inodes: Set<string>): Map<string, number> {
  const found = new Map<string, number>()
  for (const inode of inodes) {
    const owner = owners.get(inode)
    if (owner === undefined) continue
    if (readLink(`/proc/${owner.pid}/fd/${owner.fd}`) === `socket:[${inode}]`) {
      found.set(inode, owner.pid)
    }
  }
  if (found.size < inodes.size) scanFileDescriptors(inodes, found)
  for (const inode of owners.keys()) if (!found.has(inode)) owners.delete(inode)
  return found
}

/**
 * LISTEN sockets from /proc/net/tcp{,6}, mapped to pids through their socket inodes. Only our
 * own processes expose their fds, so sockets owned by other users are left out up front.
 */
export function listListeners(): RawListener[] {
  const self = process.getuid?.()
  const sockets = [...readSockets('/proc/net/tcp'), ...readSockets('/proc/net/tcp6')].filter(
    (socket) => socket.uid === self
  )
  if (sockets.length === 0) return []
  const pids = resolveOwners(new Set(sockets.map((s) => s.inode)))
  return sockets.flatMap(({ inode, port, address }) => {
    const pid = pids.get(inode)
    return pid === undefined ? [] : [{ pid, port, address }]
  })
}
