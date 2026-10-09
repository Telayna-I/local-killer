import type {
  ContainerStopResult,
  DockerState,
  KillResult,
  Settings,
  Snapshot,
  UpdateState
} from './types'

export const IPC = {
  getSnapshot: 'snapshot:get',
  killInstances: 'instances:kill',
  closeApps: 'apps:close',
  getDocker: 'docker:get',
  stopContainers: 'docker:stop',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  getAppVersion: 'app:version',
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateOpenDownload: 'update:open-download',
  updateState: 'update:state',
  updateStateChanged: 'update:state-changed'
} as const

export interface LocalKillerApi {
  getSnapshot(): Promise<Snapshot>
  killInstances(ids: string[]): Promise<KillResult>
  closeApps(ids: string[]): Promise<KillResult>
  getDocker(): Promise<DockerState>
  stopContainers(ids: string[]): Promise<ContainerStopResult>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  getAppVersion(): Promise<string>
  updates: {
    check(): Promise<void>
    install(): Promise<void>
    openDownload(): Promise<void>
    getState(): Promise<UpdateState>
    onState(listener: (state: UpdateState) => void): () => void
  }
}
