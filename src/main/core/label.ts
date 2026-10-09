import { baseName } from './classify'

const MAX_LABEL_LENGTH = 60
const JS_RUNTIMES = new Set(['node', 'bun', 'deno'])
const PYTHON = /^(python[0-9.]*|pythonw|py)$/
const NODE_BIN_ALIASES: Record<string, string> = { 'npm-cli.js': 'npm', 'npx-cli.js': 'npx' }

/** Splits a command line; quotes group words and may appear mid-token (`--dir="C:\a b"`). */
export function tokenize(commandLine: string): string[] {
  return [...commandLine.matchAll(/(?:"[^"]*"?|[^\s"])+/g)].map((m) => m[0].replaceAll('"', ''))
}

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path
const isFlag = (token: string): boolean => token.startsWith('-')
const isPath = (token: string): boolean => /[\\/]/.test(token)

/** Path segments with `.` and `..` resolved, independent of the host OS separator. */
function segments(path: string): string[] {
  const resolved: string[] = []
  for (const part of path.split(/[\\/]/)) {
    if (part === '..') resolved.pop()
    else if (part !== '.' && part !== '') resolved.push(part)
  }
  return resolved
}

/** `C:\p\node_modules\@scope\pkg\bin\x.js` → `@scope/pkg`; `.bin\vite` → `vite`. */
function packageName(path: string): string | null {
  const parts = segments(path)
  const index = parts.lastIndexOf('node_modules')
  if (index < 0 || index + 1 >= parts.length) return null
  const first = parts[index + 1]
  const second = parts[index + 2]
  if (first === '.bin' && second !== undefined) return second.replace(/\.(cmd|js|mjs|cjs)$/i, '')
  return first.startsWith('@') && second !== undefined ? `${first}/${second}` : first
}

const INLINE_CODE_FLAGS = new Set(['-e', '--eval', '-p', '--print', '-c'])

function describeScript(args: string[]): string[] {
  const scriptIndex = args.findIndex((arg) => !isFlag(arg))
  if (scriptIndex < 0) return args.slice(0, 2)
  const script = args[scriptIndex]
  const head = NODE_BIN_ALIASES[fileName(script)] ?? packageName(script) ?? fileName(script)
  // Subcommands come before options: stop at the first flag (its value would follow).
  const options = args.findIndex((arg, i) => i > scriptIndex && isFlag(arg))
  const subcommands = args.slice(scriptIndex + 1, options < 0 ? undefined : options)
  const rest = subcommands.filter((arg) => !isPath(arg)).slice(0, 2)
  return [head, ...rest]
}

/** `php -S 127.0.0.1:8000 -t public` → `php -S 127.0.0.1:8000`. */
function describePhp(args: string[]): string[] {
  return args[0] === '-S' ? ['php', '-S', args[1] ?? ''] : describeScript(args)
}

/** Short human label: `vite`, `npm run dev`, `artisan serve`, `uvicorn app:main`... */
export function describeCommand(name: string, commandLine: string | null): string {
  const runtime = baseName(name)
  if (commandLine === null) return runtime
  const args = tokenize(commandLine).slice(1)
  let parts: string[]
  if (INLINE_CODE_FLAGS.has(args[0])) {
    parts = [runtime, args[0]]
  } else if (JS_RUNTIMES.has(runtime)) {
    parts = describeScript(args)
  } else if (runtime === 'php') {
    parts = describePhp(args)
  } else if (PYTHON.test(runtime)) {
    parts = args[0] === '-m' ? args.slice(1, 3) : describeScript(args)
  } else {
    parts = [runtime, ...args.filter((arg) => !isPath(arg) && !isFlag(arg)).slice(0, 2)]
  }
  const label = parts.join(' ').trim() || runtime
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label
}
