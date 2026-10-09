import type { RawListener } from '../types'
import { parseLsofListeners } from '../parse/darwin'
import { LSOF, run } from './run'

/** TCP LISTEN sockets with their pid; lsof only sees the fds of our own processes. */
export async function listListeners(): Promise<RawListener[]> {
  return parseLsofListeners(await run(LSOF, ['-nP', '-w', '-iTCP', '-sTCP:LISTEN', '-F', 'ptn']))
}
