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

export function isDevRuntime(process: RawProcess): boolean {
  return DEV_RUNTIMES.has(baseName(process.name))
}

export function isShell(process: RawProcess): boolean {
  return baseName(process.name) in SHELLS
}

/**
 * Shell running a single command (`cmd /c vite`, `bash -c '...'`): it lives and dies with its
 * command, so it belongs to the instance. Interactive shells are the user's terminal: never killed.
 */
export function isTransientShell(process: RawProcess): boolean {
  const pattern = SHELLS[baseName(process.name)]
  return pattern !== undefined && process.commandLine !== null && pattern.test(process.commandLine)
}

/** Parents that adopt orphans on Unix: an orphan's ppid points at one of these. */
const INIT_LIKE = new Set(['init', 'launchd', 'systemd', 'tini', 'dumb-init'])

export function isInitLike(process: RawProcess): boolean {
  return process.pid === 1 || INIT_LIKE.has(baseName(process.name))
}
