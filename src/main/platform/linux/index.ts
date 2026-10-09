import type { ProcessProvider } from '../types'
import { terminate } from '../unix/kill'
import { listListeners } from './ports'
import { listProcesses, procConstants, readDetails, readStartTime } from './procfs'

/** Pure procfs: no child processes, no locale-dependent output. */
export const linuxProvider: ProcessProvider = {
  listProcesses: async () => listProcesses(await procConstants()),
  listListeners: async () => listListeners(),
  getDetails: async (target) => readDetails(target, await procConstants()),
  terminate: (targets, graceful) =>
    terminate(targets, graceful, async (pid) => readStartTime(pid, await procConstants()))
}
