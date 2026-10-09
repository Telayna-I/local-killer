import { execFile } from 'node:child_process'

export const PS = '/bin/ps'
export const LSOF = '/usr/sbin/lsof'

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024
const TIMEOUT_MS = 15_000

/**
 * Runs a BSD tool with a fixed locale and time zone (ps prints dates with strftime `%c` in local
 * time). Resolves stdout even on a non-zero exit: `lsof` and `ps -p` exit 1 when nothing matches.
 */
export function run(command: string, args: string[]): Promise<string> {
  const env = { ...process.env, LC_ALL: 'C', TZ: 'UTC' }
  return new Promise((resolve) =>
    execFile(
      command,
      args,
      { env, maxBuffer: MAX_OUTPUT_BYTES, timeout: TIMEOUT_MS },
      (_error, stdout) => resolve(String(stdout ?? ''))
    )
  )
}
