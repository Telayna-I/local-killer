import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { ConfirmProvider } from '@renderer/feedback/ConfirmProvider'
import { ToastProvider } from '@renderer/feedback/ToastProvider'
import { I18nProvider } from '@renderer/i18n/I18nProvider'
import type { LocalKillerApi } from '../../../src/shared/ipc-contract'
import type { InstanceView, KillResult, Snapshot } from '../../../src/shared/types'

/** jsdom has no showModal/close; enough of the native behaviour for the confirm flow. */
export function installDialogPolyfill(): void {
  const proto = HTMLDialogElement.prototype
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  proto.close = function close(this: HTMLDialogElement, value?: string) {
    if (!this.open) return
    if (value !== undefined) this.returnValue = value
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

export function makeInstance(overrides: Partial<InstanceView> = {}): InstanceView {
  return {
    id: '100-1',
    kind: 'dev',
    label: 'vite',
    commandLine: 'node vite',
    cwd: 'C:\\code\\shop',
    repoRoot: 'C:\\code\\shop',
    repoName: 'shop',
    origin: 'terminal',
    isOrphan: false,
    ports: [5173],
    pids: [100],
    memoryBytes: 200 * 1024 * 1024,
    cpuPercent: 1.5,
    startedAt: 1_000_000,
    limited: false,
    ...overrides
  }
}

export function makeSnapshot(instances: InstanceView[]): Snapshot {
  return {
    takenAt: 1_000_000 + 2 * 3_600_000,
    platform: 'win32',
    instances,
    topConsumers: [],
    memory: { totalBytes: 16 * 1024 ** 3, freeBytes: 6 * 1024 ** 3 }
  }
}

const EMPTY_KILL: KillResult = { killed: [], failed: [] }

export function createApiMock(): LocalKillerApi {
  return {
    getSnapshot: vi.fn<LocalKillerApi['getSnapshot']>(() => Promise.resolve(makeSnapshot([]))),
    killInstances: vi.fn<LocalKillerApi['killInstances']>(() => Promise.resolve(EMPTY_KILL)),
    closeApps: vi.fn<LocalKillerApi['closeApps']>(() => Promise.resolve(EMPTY_KILL)),
    getDocker: vi.fn<LocalKillerApi['getDocker']>(() =>
      Promise.resolve({ available: false, containers: [] })
    ),
    stopContainers: vi.fn<LocalKillerApi['stopContainers']>(() =>
      Promise.resolve({ stopped: [], failed: [] })
    ),
    getSettings: vi.fn<LocalKillerApi['getSettings']>(() =>
      Promise.resolve({ language: 'en', pollIntervalMs: 3000, protectedNames: [] })
    ),
    saveSettings: vi.fn<LocalKillerApi['saveSettings']>((settings) => Promise.resolve(settings)),
    getAppVersion: vi.fn<LocalKillerApi['getAppVersion']>(() => Promise.resolve('0.1.0')),
    updates: {
      check: vi.fn<LocalKillerApi['updates']['check']>(() => Promise.resolve()),
      install: vi.fn<LocalKillerApi['updates']['install']>(() => Promise.resolve()),
      openDownload: vi.fn<LocalKillerApi['updates']['openDownload']>(() => Promise.resolve()),
      getState: vi.fn<LocalKillerApi['updates']['getState']>(() =>
        Promise.resolve({ status: 'idle' })
      ),
      onState: vi.fn<LocalKillerApi['updates']['onState']>(() => () => undefined)
    }
  }
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(
    <I18nProvider language="en">
      <ToastProvider>
        <ConfirmProvider>{ui}</ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
