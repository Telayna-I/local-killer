import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc-contract'
import type { KillService } from '../core/kill-service'
import type { SnapshotService } from '../core/snapshot'
import type { DockerService } from '../docker/docker'
import type { SettingsStore } from '../settings/settings'
import type { Updater } from '../updater'
import { assertIdList } from './validate'

export interface IpcDependencies {
  window: BrowserWindow
  snapshots: SnapshotService
  killer: KillService
  docker: DockerService
  settings: SettingsStore
  updater: Updater
}

export function registerIpc(deps: IpcDependencies): void {
  /** Only our own window may call in; anything else (devtools extensions, iframes) is rejected. */
  const handle = <T>(channel: string, handler: (...args: unknown[]) => T): void => {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (
        event.sender !== deps.window.webContents ||
        event.senderFrame !== deps.window.webContents.mainFrame
      ) {
        throw new Error('Untrusted IPC sender')
      }
      return handler(...args)
    })
  }

  let inFlight: ReturnType<SnapshotService['take']> | null = null
  handle(IPC.getSnapshot, () => {
    inFlight ??= deps.snapshots.take().finally(() => (inFlight = null))
    return inFlight
  })
  handle(IPC.killInstances, (ids) => deps.killer.killInstances(assertIdList(ids)))
  handle(IPC.closeApps, (ids) => deps.killer.closeApps(assertIdList(ids)))
  handle(IPC.getDocker, () => deps.docker.list())
  handle(IPC.stopContainers, (ids) => deps.docker.stop(assertIdList(ids)))
  handle(IPC.getSettings, () => deps.settings.get())
  handle(IPC.saveSettings, (settings) => deps.settings.save(settings))
  handle(IPC.getAppVersion, () => app.getVersion())
  handle(IPC.updateCheck, () => deps.updater.check())
  handle(IPC.updateInstall, () => deps.updater.install())
  handle(IPC.updateOpenDownload, () => deps.updater.openDownload())
  handle(IPC.updateState, () => deps.updater.current)
}
