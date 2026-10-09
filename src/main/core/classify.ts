import type { RawProcess } from '../platform/types'

/** `Node.EXE` → `node`. Process names are compared case-insensitively without extension. */
export function baseName(name: string): string {
  return name.toLowerCase().replace(/\.exe$/, '')
}

const DEV_RUNTIMES = new Set([
  'node',
  'bun',
  'deno',
  'python',
  'python3',
  'pythonw',
  'py',
  'uv',
  'uvicorn',
  'gunicorn',
  'php',
  'php-cgi',
  'ruby',
  'rails',
  'puma',
  'java',
  'go',
  'air',
  'dotnet',
  'cargo',
  'esbuild',
  'hugo',
  'next-server',
  'beam.smp',
  'perl'
])

const SHELLS: Record<string, RegExp> = {
  cmd: /\s\/c\b/i,
  powershell: /\s-(c|command|encodedcommand|ec|file|f)\b/i,
  pwsh: /\s-(c|command|encodedcommand|ec|file|f)\b/i,
  bash: /\s-[a-z]*c\b/,
  sh: /\s-[a-z]*c\b/,
  zsh: /\s-[a-z]*c\b/,
  dash: /\s-[a-z]*c\b/,
  fish: /\s-[a-z]*c\b/
}

/** Linux reports the real interpreter binary: `python3.12`, `ruby3.3`, `php8.3`. */
const VERSIONED_RUNTIME = /^(python|ruby|php)[0-9.]+$/

export function isDevRuntime(process: RawProcess): boolean {
  const name = baseName(process.name)
  return DEV_RUNTIMES.has(name) || VERSIONED_RUNTIME.test(name)
}

export function isShell(process: RawProcess): boolean {
  return baseName(process.name) in SHELLS
}

const STAYS_OPEN = /\s-noexit\b/i

/**
 * Shell running a single command (`cmd /c vite`, `bash -c '...'`): it lives and dies with its
 * command, so it belongs to the instance. Interactive shells are the user's terminal: never killed.
 */
export function isTransientShell(process: RawProcess): boolean {
  const pattern = SHELLS[baseName(process.name)]
  const command = process.commandLine
  if (pattern === undefined || command === null || !pattern.test(command)) return false
  // `-NoExit -Command <init>` (VS Code / Windows Terminal profiles) runs a script, then stays interactive.
  return !STAYS_OPEN.test(command)
}

/** Parents that adopt orphans on Unix: an orphan's ppid points at one of these. */
const INIT_LIKE = new Set(['init', 'launchd', 'systemd', 'tini', 'dumb-init'])

export function isInitLike(process: RawProcess): boolean {
  return process.pid === 1 || INIT_LIKE.has(baseName(process.name))
}
