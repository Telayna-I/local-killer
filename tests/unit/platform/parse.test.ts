import { describe, expect, it } from 'vitest'
import { parseEnvironmentBlock } from '../../../src/main/platform/parse/environment'
import { parseTcpTableV4, parseTcpTableV6 } from '../../../src/main/platform/parse/win32-tcp'

/** Port DWORDs hold the port in network byte order in their low 16 bits. */
const networkPort = (port: number): number => ((port & 0xff) << 8) | (port >> 8)

describe('parseTcpTableV4', () => {
  it('decodes address, port and owning pid of each row', () => {
    const table = Buffer.alloc(4 + 24 * 2)
    table.writeUInt32LE(2, 0)
    Buffer.from([127, 0, 0, 1]).copy(table, 4 + 4)
    table.writeUInt32LE(networkPort(5173), 4 + 8)
    table.writeUInt32LE(4321, 4 + 20)
    table.writeUInt32LE(networkPort(3306), 28 + 8)
    table.writeUInt32LE(99, 28 + 20)

    expect(parseTcpTableV4(table)).toEqual([
      { address: '127.0.0.1', port: 5173, pid: 4321 },
      { address: '0.0.0.0', port: 3306, pid: 99 }
    ])
  })

  it('never reads past a truncated buffer', () => {
    const table = Buffer.alloc(4 + 10)
    table.writeUInt32LE(5, 0)
    expect(parseTcpTableV4(table)).toEqual([])
  })
})

describe('parseTcpTableV6', () => {
  it('decodes and compresses IPv6 addresses', () => {
    const table = Buffer.alloc(4 + 56)
    table.writeUInt32LE(1, 0)
    table[4 + 15] = 1
    table.writeUInt32LE(networkPort(3000), 4 + 20)
    table.writeUInt32LE(777, 4 + 52)

    expect(parseTcpTableV6(table)).toEqual([{ address: '::1', port: 3000, pid: 777 }])
  })
})

describe('parseEnvironmentBlock', () => {
  it('parses NUL separated pairs, keeping `=` in values and hidden `=C:` keys', () => {
    const block = '=C:=C:\\dev\0PATH=C:\\bin\0CLAUDE_PID=6400\0OPTS=a=b\0\0garbage=1\0'
    expect(parseEnvironmentBlock(block)).toEqual({
      '=C:': 'C:\\dev',
      PATH: 'C:\\bin',
      CLAUDE_PID: '6400',
      OPTS: 'a=b'
    })
  })
})
