import type { LocalKillerApi } from '../shared/ipc-contract'

declare global {
  interface Window {
    api: LocalKillerApi
  }
}
