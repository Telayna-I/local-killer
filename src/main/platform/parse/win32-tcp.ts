import type { RawListener } from '../types'

// MIB_TCPTABLE_OWNER_PID / MIB_TCP6TABLE_OWNER_PID: DWORD dwNumEntries, then fixed-size rows.
const ROW_SIZE_V4 = 24
const ROW_SIZE_V6 = 56
const TABLE_HEADER_SIZE = 4

/** Ports are stored in network byte order in the low 16 bits of a DWORD. */
function decodePort(dword: number): number {
  return ((dword & 0xff) << 8) | ((dword >> 8) & 0xff)
}

function formatIpv6(bytes: Buffer): string {
  const groups: string[] = []
  for (let i = 0; i < 16; i += 2) groups.push(bytes.readUInt16BE(i).toString(16))
  // The WHATWG URL parser emits the canonical compressed form (RFC 5952).
  return new URL(`http://[${groups.join(':')}]`).hostname.slice(1, -1)
}

export function parseTcpTableV4(table: Buffer): RawListener[] {
  const count = table.readUInt32LE(0)
  const listeners: RawListener[] = []
  for (let i = 0; i < count; i++) {
    const row = TABLE_HEADER_SIZE + i * ROW_SIZE_V4
    if (row + ROW_SIZE_V4 > table.length) break
    const address = [0, 1, 2, 3].map((b) => table[row + 4 + b]).join('.')
    listeners.push({
      address,
      port: decodePort(table.readUInt32LE(row + 8)),
      pid: table.readUInt32LE(row + 20)
    })
  }
  return listeners
}

export function parseTcpTableV6(table: Buffer): RawListener[] {
  const count = table.readUInt32LE(0)
  const listeners: RawListener[] = []
  for (let i = 0; i < count; i++) {
    const row = TABLE_HEADER_SIZE + i * ROW_SIZE_V6
    if (row + ROW_SIZE_V6 > table.length) break
    listeners.push({
      address: formatIpv6(table.subarray(row, row + 16)),
      port: decodePort(table.readUInt32LE(row + 20)),
      pid: table.readUInt32LE(row + 52)
    })
  }
  return listeners
}
