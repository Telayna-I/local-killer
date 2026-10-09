import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/format'

export interface Polled<T> {
  data: T | null
  error: string | null
  /** Fetches now. If a request is in flight, one more runs right after it (never in parallel). */
  refresh: () => Promise<void>
}

/**
 * Polls `fetcher` every `intervalMs` while the window is visible, refreshes as soon as it becomes
 * visible again, and never overlaps requests. `fetcher` must be stable (module-level function).
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): Polled<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = useRef<Promise<void> | null>(null)
  const queued = useRef(false)

  const refresh = useCallback((): Promise<void> => {
    if (running.current) {
      queued.current = true
      return running.current
    }
    const run = async (): Promise<void> => {
      do {
        queued.current = false
        try {
          setData(await fetcher())
          setError(null)
        } catch (caught) {
          setError(errorMessage(caught))
        }
      } while (queued.current)
    }
    running.current = run().finally(() => {
      running.current = null
    })
    return running.current
  }, [fetcher])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    const visible = (): boolean => document.visibilityState === 'visible'

    const tick = async (): Promise<void> => {
      clearTimeout(timer)
      await refresh()
      // Concurrent ticks share one request; clearing first keeps a single timer alive.
      clearTimeout(timer)
      if (!disposed && visible()) timer = setTimeout(() => void tick(), intervalMs)
    }
    const onVisibilityChange = (): void => {
      if (visible()) void tick()
      else clearTimeout(timer)
    }

    if (visible()) void tick()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      disposed = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh, intervalMs])

  return { data, error, refresh }
}
