import type { ProcessProvider } from '../types'
import { terminate } from './kill'
import { readProcessDetails } from './peb'
import { listListeners } from './ports'
import { listProcesses } from './processes'

export const win32Provider: ProcessProvider = {
  listProcesses: async () => listProcesses(),
  listListeners: async () => listListeners(),
  getDetails: async (target) => readProcessDetails(target),
  terminate
}
