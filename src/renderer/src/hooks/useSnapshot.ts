import type { Snapshot } from '../../../shared/types'
import { usePolling } from './usePolling'

const fetchSnapshot = (): Promise<Snapshot> => window.api.getSnapshot()

export function useSnapshot(intervalMs: number): {
  snapshot: Snapshot | null
  error: string | null
  refresh: () => Promise<void>
} {
  const { data, error, refresh } = usePolling(fetchSnapshot, intervalMs)
  return { snapshot: data, error, refresh }
}
