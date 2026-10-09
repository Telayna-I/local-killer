import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../shared/types'

const RELEASES_URL = 'https://github.com/telayna-i/localkiller/releases/latest'
const STARTUP_CHECK_DELAY_MS = 5000

/**
 * Windows (NSIS) and Linux (AppImage/deb) update in place. macOS builds are unsigned and Squirrel.Mac
 * refuses unsigned updates, so there the app only announces the version and links to the download.
 */
export class Updater {
  private state: UpdateState = { status: 'idle' }
  private readonly manualOnly = process.platform === 'darwin'

  constructor(private readonly publish: (state: UpdateState) => void) {
    autoUpdater.autoDownload = !this.manualOnly
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ status: 'checking' }))
    autoUpdater.on('update-not-available', () => this.set({ status: 'not-available' }))
    autoUpdater.on('update-available', (info) =>
      this.set({
        status: 'available',
        version: info.version,
        manualDownloadUrl: this.manualOnly ? RELEASES_URL : null
      })
    )
    autoUpdater.on('download-progress', (progress) => {
      const version = 'version' in this.state ? this.state.version : ''
      this.set({ status: 'downloading', version, percent: Math.round(progress.percent) })
    })
    autoUpdater.on('update-downloaded', (info) =>
      this.set({ status: 'downloaded', version: info.version })
    )
    autoUpdater.on('error', (error) => this.set({ status: 'error', message: error.message }))
  }

  get current(): UpdateState {
    return this.state
  }

  scheduleStartupCheck(): void {
    setTimeout(() => void this.check(), STARTUP_CHECK_DELAY_MS)
  }

  async check(): Promise<void> {
    // Dev builds have no app-update.yml; checking would only produce an error state.
    if (!app.isPackaged) return
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.set({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  install(): void {
    if (this.state.status === 'downloaded') autoUpdater.quitAndInstall()
  }

  async openDownload(): Promise<void> {
    await shell.openExternal(RELEASES_URL)
  }

  private set(state: UpdateState): void {
    this.state = state
    this.publish(state)
  }
}
