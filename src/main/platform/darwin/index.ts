import type { ProcessProvider } from '../types'
import { terminate } from '../unix/kill'
import { readDetails } from './details'
import { listListeners } from './ports'
import { listProcesses, startTimeOf } from './processes'

/** ps + lsof for the lists, libSystem (koffi) for executable paths, argv, cwd and environment. */
export const darwinProvider: ProcessProvider = {
  listProcesses,
  listListeners,
  getDetails: readDetails,
  terminate: (targets, graceful) => terminate(targets, graceful, startTimeOf)
}
