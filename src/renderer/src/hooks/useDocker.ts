import type { DockerState } from '../../../shared/types'
import { usePolling, type Polled } from './usePolling'

const fetchDocker = (): Promise<DockerState> => window.api.getDocker()

/** Mounted only while the Docker tab is open, so `docker ps` never runs in the background. */
export function useDocker(intervalMs: number): Polled<DockerState> {
  return usePolling(fetchDocker, intervalMs)
}
