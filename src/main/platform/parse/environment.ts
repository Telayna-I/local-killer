/**
 * Parses a NUL-separated `KEY=VALUE` environment block (Windows PEB, /proc/<pid>/environ,
 * KERN_PROCARGS2). Windows hidden entries such as `=C:=C:\dir` keep their leading `=`.
 */
export function parseEnvironmentBlock(block: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const entry of block.split('\0')) {
    if (entry === '') {
      if (Object.keys(env).length > 0) break
      continue
    }
    const separator = entry.indexOf('=', 1)
    if (separator <= 0) continue
    env[entry.slice(0, separator)] = entry.slice(separator + 1)
  }
  return env
}
