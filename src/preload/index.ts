import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type LocalKillerApi } from '../shared/ipc-contract'
import type { UpdateState } from '../shared/types'

// Sandboxed preload: only `electron` can be required, everything else is bundled in.
const api: LocalKillerApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  killInstances: (ids) => ipcRenderer.invoke(IPC.killInstances, ids),
  closeApps: (ids) => ipcRenderer.invoke(IPC.closeApps, ids),
  getDocker: () => ipcRenderer.invoke(IPC.getDocker),
  stopContainers: (ids) => ipcRenderer.invoke(IPC.stopContainers, ids),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (settings) => ipcRenderer.invoke(IPC.saveSettings, settings),
  getAppVersion: () => ipcRenderer.invoke(IPC.getAppVersion),
  updates: {
    check: () => ipcRenderer.invoke(IPC.updateCheck),
    install: () => ipcRenderer.invoke(IPC.updateInstall),
    openDownload: () => ipcRenderer.invoke(IPC.updateOpenDownload),
    getState: () => ipcRenderer.invoke(IPC.updateState),
    onState: (listener) => {
      const wrapped = (_event: IpcRendererEvent, state: UpdateState): void => listener(state)
      ipcRenderer.on(IPC.updateStateChanged, wrapped)
      return () => ipcRenderer.removeListener(IPC.updateStateChanged, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
