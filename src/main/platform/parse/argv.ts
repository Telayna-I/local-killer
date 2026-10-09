const needsQuotes = (arg: string): boolean => arg === '' || /\s/.test(arg)

/**
 * argv → one command line, quoting arguments with spaces so `tokenize` splits it back the same way.
 * A title written over argv (setproctitle, Node's `process.title`) fills the first slot and leaves
 * only empty ones behind: it is returned verbatim.
 */
export function commandLineFromArgv(argv: string[]): string | null {
  if (argv.length === 0) return null
  const [first, ...rest] = argv
  if (rest.length > 0 && rest.every((arg) => arg === '')) return first === '' ? null : first
  return argv.map((arg) => (needsQuotes(arg) ? `"${arg}"` : arg)).join(' ')
}
