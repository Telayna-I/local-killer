import type { RawListener } from '../types'
import { parseTcpTableV4, parseTcpTableV6 } from '../parse/win32-tcp'
import { AF_INET, AF_INET6, GetExtendedTcpTable, TCP_TABLE_OWNER_PID_LISTENER } from './ffi'

const NO_ERROR = 0
const MAX_ATTEMPTS = 3

function readTable(family: number): Buffer | null {
  const size = [16 * 1024]
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const table = Buffer.alloc(size[0])
    const result: number = GetExtendedTcpTable(
      table,
      size,
      false,
      family,
      TCP_TABLE_OWNER_PID_LISTENER,
      0
    )
    if (result === NO_ERROR) return table
    // ERROR_INSUFFICIENT_BUFFER updates `size`; the table may grow between calls, so retry.
  }
  return null
}

export function listListeners(): RawListener[] {
  const v4 = readTable(AF_INET)
  const v6 = readTable(AF_INET6)
  return [...(v4 ? parseTcpTableV4(v4) : []), ...(v6 ? parseTcpTableV6(v6) : [])]
}
