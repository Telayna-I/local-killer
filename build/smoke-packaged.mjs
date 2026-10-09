// Packaged smoke test: runs the unpacked app from `electron-builder --dir` with `--smoke` and checks
// the JSON verdict printed by src/main/smoke.ts. Used by `npm run release:check` and the release CI.
// Usage: node build/smoke-packaged.mjs [--arch x64|arm64]
//
// stdout is read through a pipe: the Windows build is a GUI-subsystem exe, so its output is only
// visible when redirected (pipe/file), never in an interactive console window.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const archIndex = process.argv.indexOf('--arch')
const arch = archIndex === -1 ? process.arch : process.argv[archIndex + 1]
const release = join(import.meta.dirname, '..', 'release')

const binary = {
  win32: join(release, 'win-unpacked', 'LocalKiller.exe'),
  darwin: join(
    release,
    arch === 'arm64' ? 'mac-arm64' : 'mac',
    'LocalKiller.app',
    'Contents',
    'MacOS',
    'LocalKiller'
  ),
  linux: join(release, arch === 'arm64' ? 'linux-arm64-unpacked' : 'linux-unpacked', 'localkiller')
}[process.platform]

if (!binary || !existsSync(binary)) {
  console.error(`Packaged app not found at ${binary}. Run \`electron-builder --dir\` first.`)
  process.exit(1)
}

let command = binary
let args = ['--smoke']
if (process.platform === 'linux') {
  // The unpacked chrome-sandbox is not SUID root and Ubuntu 24.04 restricts user namespaces.
  args.push('--no-sandbox')
  if (!process.env.DISPLAY) [command, args] = ['xvfb-run', ['-a', binary, ...args]]
}

const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120_000 })
const stdout = result.stdout ?? ''
const verdictLine = stdout
  .split(/\r?\n/)
  .reverse()
  .find((line) => line.startsWith('{'))
let verdict = null
try {
  verdict = verdictLine ? JSON.parse(verdictLine) : null
} catch {
  // reported below
}

console.log(`${binary} --smoke → exit ${result.status ?? result.signal ?? result.error?.message}`)
if (verdictLine) console.log(verdictLine)
if (result.status !== 0 || verdict?.ok !== true) {
  console.error('Packaged smoke test FAILED')
  if (stdout.trim()) console.error(`stdout:\n${stdout}`)
  if (result.stderr?.trim()) console.error(`stderr:\n${result.stderr}`)
  process.exit(1)
}
