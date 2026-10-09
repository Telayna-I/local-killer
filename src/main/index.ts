import { app } from 'electron'
import { basename, join } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc-contract'
import { KillService } from './core/kill-service'
import { SnapshotService } from './core/snapshot'
import { DockerService } from './docker/docker'
import { registerIpc } from './ipc/register'
import { getProvider } from './platform'
import { SettingsStore } from './settings/settings'
import { runSmokeTest } from './smoke'
import { Updater } from './updater'
import { createMainWindow } from './window'

if (!app.requestSingleInstanceLock()) app.quit()

async function start(): Promise<void> {
  electronApp.setAppUserModelId('com.telayna.localkiller')
  const provider = await getProvider()
  const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
  // Our own executable covers Electron's helper processes (renderer, GPU, utility).
  const snapshots = new SnapshotService(provider, () => settings.get(), {
    extraProtectedNames: [basename(process.execPath)]
  })

  if (process.argv.includes('--smoke')) {
    await runSmokeTest(snapshots)
    return
  }

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  const window = createMainWindow()
  const updater = new Updater((state) => {
    if (!window.isDestroyed()) window.webContents.send(IPC.updateStateChanged, state)
  })
  registerIpc({
    window,
    snapshots,
    killer: new KillService(provider, snapshots),
    docker: new DockerService(),
    settings,
    updater
  })
  updater.scheduleStartupCheck()

  app.on('second-instance', () => {
    if (window.isMinimized()) window.restore()
    window.focus()
  })
}

app.whenReady().then(start)

// A plain window app on every platform (no tray, no dock-only mode): closing it quits.
app.on('window-all-closed', () => app.quit())
