import type { Origin } from '../../shared/types'
import type { RawProcess } from '../platform/types'
import { baseName, isShell } from './classify'

type Env = Record<string, string>

const lowered = (value: string | undefined): string => (value ?? '').toLowerCase()

/**
 * Environment variables are inherited by every child and survive the death of the launcher.
 * `CLAUDECODE=1` alone is not enough: IDE extensions export it in their integrated terminals.
 */
const ENV_RULES: { origin: Origin; test: (env: Env) => boolean }[] = [
  {
    origin: 'claude-code',
    test: (env) =>
      env.CLAUDE_CODE_CHILD_SESSION === '1' ||
      lowered(env.AI_AGENT).startsWith('claude-code') ||
      env.CLAUDE_PID !== undefined
  },
  {
    origin: 'cursor',
    test: (env) =>
      env.CURSOR_TRACE_ID !== undefined || lowered(env.VSCODE_GIT_ASKPASS_NODE).includes('cursor')
  },
  { origin: 'vscode', test: (env) => env.TERM_PROGRAM === 'vscode' },
  { origin: 'jetbrains', test: (env) => lowered(env.TERMINAL_EMULATOR).includes('jetbrains') },
  {
    origin: 'terminal',
    test: (env) => env.WT_SESSION !== undefined || env.TERM_PROGRAM !== undefined
  }
]

const JETBRAINS =
  /^(idea|webstorm|phpstorm|pycharm|goland|rider|clion|rubymine|datagrip|rustrover|studio)(64)?$/

const TERMINALS = new Set([
  'windowsterminal',
  'openconsole',
  'wt',
  'terminal',
  'iterm2',
  'alacritty',
  'wezterm',
  'wezterm-gui',
  'kitty',
  'ghostty',
  'gnome-terminal-server',
  'konsole',
  'xterm',
  'tilix',
  'hyper',
  'warp',
  'tabby'
])

function originOfProcess(process: RawProcess): Origin | null {
  const name = baseName(process.name)
  const command = lowered(process.commandLine ?? undefined)
  if (name === 'claude' || command.includes('@anthropic-ai/claude-code')) return 'claude-code'
  if (name === 'cursor') return 'cursor'
  if (name === 'code' || name === 'code - insiders' || name === 'codium') return 'vscode'
  if (JETBRAINS.test(name)) return 'jetbrains'
  if (TERMINALS.has(name)) return 'terminal'
  return null
}

export function originFromEnv(env: Env | null): Origin | null {
  if (env === null) return null
  return ENV_RULES.find((rule) => rule.test(env))?.origin ?? null
}

/** Closest recognizable ancestor; a bare interactive shell still means "terminal". */
export function originFromAncestors(ancestors: RawProcess[]): Origin | null {
  for (const ancestor of ancestors) {
    const origin = originOfProcess(ancestor)
    if (origin !== null) return origin
  }
  return ancestors.some(isShell) ? 'terminal' : null
}

export function detectOrigin(env: Env | null, ancestors: RawProcess[]): Origin {
  return originFromEnv(env) ?? originFromAncestors(ancestors) ?? 'unknown'
}

/** PID of the Claude Code session that launched the process, when it exported one. */
export function claudeSessionPid(env: Env | null): number | null {
  const pid = Number(env?.CLAUDE_PID)
  return Number.isInteger(pid) && pid > 0 ? pid : null
}
