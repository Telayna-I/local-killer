// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from '@renderer/components/UpdateBanner'
import { usePolling } from '@renderer/hooks/usePolling'
import type { UpdateState } from '../../../src/shared/types'
import { createApiMock, renderWithProviders } from './helpers'

let visibility: DocumentVisibilityState = 'visible'
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })

const setVisibility = (next: DocumentVisibilityState): void => {
  visibility = next
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  visibility = 'visible'
  window.api = createApiMock()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('usePolling', () => {
  const pending: ((value: number) => void)[] = []
  const fetcher = vi.fn(() => new Promise<number>((resolve) => pending.push(resolve)))
  beforeEach(() => {
    pending.length = 0
    fetcher.mockClear()
  })

  it('never overlaps requests and only polls while the window is visible', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => usePolling(fetcher, 1000))
    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => pending[0](1))
    expect(result.current.data).toBe(1)
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(fetcher).toHaveBeenCalledTimes(2)
    await act(async () => pending[1](2))

    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(fetcher).toHaveBeenCalledTimes(2)

    setVisibility('visible')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('a refresh during an in-flight request queues exactly one follow-up', async () => {
    const { result } = renderHook(() => usePolling(fetcher, 60_000))
    act(() => {
      void result.current.refresh()
      void result.current.refresh()
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => pending[0](1))
    expect(fetcher).toHaveBeenCalledTimes(2)
    await act(async () => pending[1](2))
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.current.data).toBe(2)
  })
})

describe('UpdateBanner', () => {
  it('follows pushed states and unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn()
    let push: (state: UpdateState) => void = () => undefined
    vi.mocked(window.api.updates.onState).mockImplementation((listener) => {
      push = listener
      return unsubscribe
    })
    const { unmount } = renderWithProviders(<UpdateBanner />)
    await act(async () => undefined)
    expect(screen.queryByTestId('update-banner')).toBeNull()

    act(() => push({ status: 'downloading', version: '0.2.0', percent: 40 }))
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40')

    act(() => push({ status: 'downloaded', version: '0.2.0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restart and update' }))
    expect(window.api.updates.install).toHaveBeenCalledTimes(1)

    act(() => push({ status: 'available', version: '0.3.0', manualDownloadUrl: 'https://x' }))
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(window.api.updates.openDownload).toHaveBeenCalledTimes(1)

    act(() => push({ status: 'not-available' }))
    expect(screen.queryByText('Download')).toBeNull()

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
