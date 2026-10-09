import { describe, expect, it } from 'vitest'
import {
  VNODE_PATH_INFO_SIZE,
  commandLineFromPsArgs,
  nameFromPsArgs,
  parseCpuTime,
  parseLsofCwd,
  parseLsofListeners,
  parseLstart,
  parseProcArgs2,
  parsePsProcesses,
  parsePsStartTimes,
  parseVnodePathInfo
} from '../../../src/main/platform/parse/darwin'

// `ps -axww -o pid=,ppid=,uid=,rss=,time=,stat=,lstart=,args=` with LC_ALL=C TZ=UTC: lstart is
// left-justified in a 28-column field, args is the rest of the line.
const PS_OUTPUT = [
  '    1     0     0  13344   2:31.51 Ss   Thu Oct  8 07:58:12 2026     /sbin/launchd',
  '  377     1     0      0   0:00.00 Ss   Thu Oct  8 07:58:15 2026     (logd)',
  '  612     1   501 412816  12:03.97 S    Thu Oct  8 08:01:40 2026     /Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ' 4242   980   501  65536   0:01.20 S+   Fri Oct  9 10:21:58 2026     node /Users/dev/My Projects/app/node_modules/.bin/vite --port 5173',
  ' 4300  4242   501      0   0:00.00 Z    Fri Oct  9 10:22:01 2026     <defunct>',
  '99999 98765   501   1024 1234:56.78 R   Mon Dec 31 23:59:59 2029     -zsh',
  ''
].join('\n')

describe('parseLstart', () => {
  it('parses the C locale strftime %c format as UTC', () => {
    expect(parseLstart('Fri Oct  9 10:21:58 2026')).toBe(Date.UTC(2026, 9, 9, 10, 21, 58))
    expect(parseLstart('Mon Dec 31 23:59:59 2029  ')).toBe(Date.UTC(2029, 11, 31, 23, 59, 59))
  })

  it('rejects other locales and garbage', () => {
    expect(parseLstart('vie  9 oct 10:21:58 2026')).toBeNull()
    expect(parseLstart('Fri Foo  9 10:21:58 2026')).toBeNull()
  })
})

describe('parseCpuTime', () => {
  it.each([
    ['0:00.03', 30],
    ['2:31.51', 151_510],
    ['1234:56.78', 74_096_780],
    ['01:02:03', 3_723_000],
    ['1-00:00:01', 86_401_000]
  ])('%s → %d ms', (text, ms) => {
    expect(parseCpuTime(text)).toBe(ms)
  })

  it('returns null for placeholders', () => {
    expect(parseCpuTime('-')).toBeNull()
  })
})

describe('parsePsProcesses', () => {
  it('parses every column, keeping spaces inside args', () => {
    const rows = parsePsProcesses(PS_OUTPUT)
    expect(rows).toHaveLength(6)
    expect(rows[0]).toEqual({
      pid: 1,
      ppid: 0,
      uid: 0,
      rssKb: 13344,
      cpuTimeMs: 151_510,
      state: 'Ss',
      startTimeMs: Date.UTC(2026, 9, 8, 7, 58, 12),
      args: '/sbin/launchd'
    })
    expect(rows[2].args).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    expect(rows[3]).toMatchObject({
      pid: 4242,
      ppid: 980,
      uid: 501,
      rssKb: 65536,
      state: 'S+',
      startTimeMs: Date.UTC(2026, 9, 9, 10, 21, 58),
      args: 'node /Users/dev/My Projects/app/node_modules/.bin/vite --port 5173'
    })
    expect(rows[4]).toMatchObject({ pid: 4300, state: 'Z', args: '<defunct>' })
    expect(rows[5]).toMatchObject({ pid: 99999, cpuTimeMs: 74_096_780, args: '-zsh' })
  })

  it('skips lines that do not match the column layout', () => {
    expect(parsePsProcesses('  PID  PPID\nps: garbage\n')).toEqual([])
  })
})

describe('parsePsStartTimes', () => {
  it('maps pids to start times and drops zombies', () => {
    const output = [
      ' 4242 S+   Fri Oct  9 10:21:58 2026    ',
      ' 4300 Z    Fri Oct  9 10:22:01 2026    ',
      '   12 Ss   Thu Oct  8 07:58:12 2026    '
    ].join('\n')
    expect(parsePsStartTimes(output)).toEqual(
      new Map([
        [4242, Date.UTC(2026, 9, 9, 10, 21, 58)],
        [12, Date.UTC(2026, 9, 8, 7, 58, 12)]
      ])
    )
  })
})

describe('ps args fallbacks', () => {
  it('treats `(comm)` as unreadable arguments', () => {
    expect(commandLineFromPsArgs('(logd)')).toBeNull()
    expect(commandLineFromPsArgs('')).toBeNull()
    expect(commandLineFromPsArgs('node server.js')).toBe('node server.js')
  })

  it('derives a name from comm or argv[0]', () => {
    expect(nameFromPsArgs('(logd)')).toBe('logd')
    expect(nameFromPsArgs('-zsh')).toBe('zsh')
    expect(nameFromPsArgs('/usr/local/bin/node server.js')).toBe('node')
  })
})

describe('parseLsofListeners', () => {
  it('reads pid, address family and port of each listening socket', () => {
    const output = [
      'p612',
      'f45',
      'tIPv4',
      'n127.0.0.1:7679',
      'p4242',
      'f23',
      'tIPv6',
      'n*:5173',
      'f24',
      'tIPv4',
      'n*:5173',
      'f25',
      'tIPv6',
      'n[::1]:9229',
      ''
    ].join('\n')
    expect(parseLsofListeners(output)).toEqual([
      { pid: 612, port: 7679, address: '127.0.0.1' },
      { pid: 4242, port: 5173, address: '::' },
      { pid: 4242, port: 5173, address: '0.0.0.0' },
      { pid: 4242, port: 9229, address: '::1' }
    ])
  })

  it('copes with file sets lacking the f field', () => {
    const output = 'p10\ntIPv4\nn127.0.0.1:3000\ntIPv6\nn[::1]:3001\n'
    expect(parseLsofListeners(output)).toEqual([
      { pid: 10, port: 3000, address: '127.0.0.1' },
      { pid: 10, port: 3001, address: '::1' }
    ])
  })

  it('returns nothing for empty output (lsof exits 1 when nothing listens)', () => {
    expect(parseLsofListeners('')).toEqual([])
  })
})

describe('parseLsofCwd', () => {
  it('reads the name field of the cwd file set', () => {
    expect(parseLsofCwd('p4242\nfcwd\nn/Users/dev/My Projects/app\n')).toBe(
      '/Users/dev/My Projects/app'
    )
    expect(parseLsofCwd('')).toBeNull()
  })
})

/** KERN_PROCARGS2 layout: int argc, exec path, NUL padding, argv, env, empty string, apple strings. */
function procArgs2(argv: string[], env: string[], padding = 7): Buffer {
  const argc = Buffer.alloc(4)
  argc.writeInt32LE(argv.length)
  const strings = [
    '/usr/local/bin/node\0',
    '\0'.repeat(padding),
    ...argv.map((a) => `${a}\0`),
    ...env.map((e) => `${e}\0`),
    '\0',
    'executable_path=/usr/local/bin/node\0ptr_munge=\0'
  ]
  return Buffer.concat([argc, Buffer.from(strings.join(''), 'utf8')])
}

describe('parseProcArgs2', () => {
  it('splits exec path, argv (including empty arguments) and environment', () => {
    const data = procArgs2(
      ['node', '/Users/dev/My Projects/app/server.js', '', '--port=3000'],
      ['PATH=/usr/bin:/bin', 'CLAUDE_CODE_CHILD_SESSION=1', 'OPTS=a=b']
    )
    expect(parseProcArgs2(data)).toEqual({
      executablePath: '/usr/local/bin/node',
      argv: ['node', '/Users/dev/My Projects/app/server.js', '', '--port=3000'],
      env: { PATH: '/usr/bin:/bin', CLAUDE_CODE_CHILD_SESSION: '1', OPTS: 'a=b' }
    })
  })

  it('handles processes without environment and truncated buffers', () => {
    expect(parseProcArgs2(procArgs2(['sleep', '10'], []))).toMatchObject({
      argv: ['sleep', '10'],
      env: {}
    })
    expect(parseProcArgs2(Buffer.alloc(2))).toBeNull()
  })
})

describe('parseVnodePathInfo', () => {
  it('reads the cwd path after the 152-byte vnode_info', () => {
    const data = Buffer.alloc(VNODE_PATH_INFO_SIZE)
    expect(VNODE_PATH_INFO_SIZE).toBe(2352)
    data.write('/private/var/folders/xy/T/localkiller-abc', 152, 'utf8')
    data.write('/', 152 + 1176, 'utf8')
    expect(parseVnodePathInfo(data)).toBe('/private/var/folders/xy/T/localkiller-abc')
  })

  it('returns null for an empty path or a short buffer', () => {
    expect(parseVnodePathInfo(Buffer.alloc(VNODE_PATH_INFO_SIZE))).toBeNull()
    expect(parseVnodePathInfo(Buffer.alloc(100))).toBeNull()
  })
})
