import { describe, expect, it } from 'vitest'
import { commandLineFromArgv } from '../../../src/main/platform/parse/argv'
import {
  isDeadState,
  parseBootTime,
  parseProcCmdline,
  parseProcNetTcp,
  parseProcStat,
  socketInode
} from '../../../src/main/platform/parse/procfs'

describe('commandLineFromArgv', () => {
  it('quotes arguments with spaces and empty ones', () => {
    expect(
      commandLineFromArgv(['node', '/home/me/My Projects/app/server.js', '', '--port=3000'])
    ).toBe('node "/home/me/My Projects/app/server.js" "" --port=3000')
  })

  it('returns a title written over argv verbatim', () => {
    expect(commandLineFromArgv(['npm run dev', '', '', ''])).toBe('npm run dev')
  })

  it('quotes a lone executable path with spaces', () => {
    expect(
      commandLineFromArgv(['/Applications/Visual Studio Code.app/Contents/MacOS/Electron'])
    ).toBe('"/Applications/Visual Studio Code.app/Contents/MacOS/Electron"')
  })

  it('returns null without arguments', () => {
    expect(commandLineFromArgv([])).toBeNull()
    expect(commandLineFromArgv(['', ''])).toBeNull()
  })
})

describe('parseProcStat', () => {
  const NODE =
    '4242 (node) S 4100 4242 4100 34816 4242 4194304 12345 0 3 0 250 75 0 0 20 0 11 0 987654 ' +
    '1234567890 15360 18446744073709551615 1 1 0 0 0 0 0 4096 17920 0 0 0 17 3 0 0 0 0 0\n'

  it('reads ppid, state, CPU ticks, start ticks and RSS pages', () => {
    expect(parseProcStat(NODE)).toEqual({
      pid: 4242,
      comm: 'node',
      state: 'S',
      ppid: 4100,
      utimeTicks: 250,
      stimeTicks: 75,
      startTicks: 987654,
      rssPages: 15360
    })
  })

  it('splits at the last parenthesis when comm contains spaces and parentheses', () => {
    const line = NODE.replace('(node)', '(Web Content (x))').replace(' S ', ' Z ')
    expect(parseProcStat(line)).toMatchObject({ comm: 'Web Content (x)', state: 'Z', ppid: 4100 })
  })

  it('rejects truncated or garbage content', () => {
    expect(parseProcStat('4242 (node) S 4100')).toBeNull()
    expect(parseProcStat('garbage')).toBeNull()
  })
})

describe('isDeadState', () => {
  it('treats zombies and dead tasks as gone', () => {
    expect(['Z', 'X', 'x'].map(isDeadState)).toEqual([true, true, true])
    expect(['R', 'S', 'D', 'T', 'I'].some(isDeadState)).toBe(false)
  })
})

describe('parseBootTime', () => {
  it('reads btime from /proc/stat', () => {
    const stat = 'cpu  1 2 3 4\ncpu0 1 2 3 4\nintr 0\nctxt 99\nbtime 1791530000\nprocesses 5\n'
    expect(parseBootTime(stat)).toBe(1791530000)
    expect(parseBootTime('cpu 1 2 3\n')).toBeNull()
  })
})

describe('parseProcCmdline', () => {
  it('quotes NUL-separated arguments that contain spaces', () => {
    const raw = 'node\0/home/me/My Projects/app/node_modules/.bin/vite\0--port\x005173\0'
    expect(parseProcCmdline(raw)).toBe(
      'node "/home/me/My Projects/app/node_modules/.bin/vite" --port 5173'
    )
  })

  it('keeps titles verbatim, padded (process.title) or read past argv (setproctitle)', () => {
    expect(parseProcCmdline('npm run dev\0\0\0\0\0\0')).toBe('npm run dev')
    expect(parseProcCmdline('/opt/google/chrome/chrome --type=renderer --lang=en\0')).toBe(
      '/opt/google/chrome/chrome --type=renderer --lang=en'
    )
  })

  it('returns null for kernel threads', () => {
    expect(parseProcCmdline('')).toBeNull()
  })
})

const TCP4 = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:0CEA 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41234 1 0000000000000000 100 0 0 10 0
   1: 3500007F:0035 00000000:0000 0A 00000000:00000000 00:00000000 00000000   101        0 18012 1 0000000000000000 100 0 0 10 5
   2: 0100007F:0CEA 0100007F:D2F4 01 00000000:00000000 00:00000000 00000000  1000        0 52311 1 0000000000000000 20 4 30 10 -1
   3: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41299 1 0000000000000000 100 0 0 10 0
`

const TCP6 = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000000000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 61234 1 0000000000000000 100 0 0 10 0
   1: 00000000000000000000000001000000:1435 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 61235 1 0000000000000000 100 0 0 10 0
   2: 0000000000000000FFFF00000100007F:0050 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 61236 1 0000000000000000 100 0 0 10 0
`

describe('parseProcNetTcp', () => {
  it('decodes LISTEN rows of /proc/net/tcp on little-endian hosts', () => {
    expect(parseProcNetTcp(TCP4, true)).toEqual([
      { address: '127.0.0.1', port: 3306, uid: 1000, inode: '41234' },
      { address: '127.0.0.53', port: 53, uid: 101, inode: '18012' },
      { address: '0.0.0.0', port: 8080, uid: 1000, inode: '41299' }
    ])
  })

  it('decodes and compresses IPv6 addresses word by word', () => {
    expect(parseProcNetTcp(TCP6, true)).toEqual([
      { address: '::', port: 8080, uid: 1000, inode: '61234' },
      { address: '::1', port: 5173, uid: 1000, inode: '61235' },
      { address: '::ffff:7f00:1', port: 80, uid: 0, inode: '61236' }
    ])
  })

  it('keeps byte order on big-endian hosts', () => {
    const row = `header\n   0: 7F000001:0050 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 7 1\n`
    expect(parseProcNetTcp(row, false)).toEqual([
      { address: '127.0.0.1', port: 80, uid: 1000, inode: '7' }
    ])
  })
})

describe('socketInode', () => {
  it('extracts the inode of socket fds only', () => {
    expect(socketInode('socket:[41234]')).toBe('41234')
    expect(socketInode('pipe:[41234]')).toBeNull()
    expect(socketInode('/dev/null')).toBeNull()
  })
})
