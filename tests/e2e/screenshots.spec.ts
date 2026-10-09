import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { DEFAULT_PROTECTED_NAMES } from '../../src/main/core/protect'
import { IPC } from '../../src/shared/ipc-contract'
import { demoData } from './demo-data'
import { launchApp, ROOT, type LaunchedApp } from './launch'

const SHOTS = join(ROOT, 'docs', 'screenshots')

// Regenerates the README screenshots from fictional data: LK_SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env['LK_SCREENSHOTS'], 'set LK_SCREENSHOTS=1 to regenerate docs/screenshots')

test.describe('README screenshots', () => {
  let launched: LaunchedApp

  test.beforeAll(async () => {
    launched = await launchApp()
    const data = demoData(DEFAULT_PROTECTED_NAMES)
    // Every channel is answered by the demo: nothing on this machine is read, killed or closed.
    await launched.app.evaluate(
      ({ ipcMain }, { channels, data }) => {
        const nothingKilled = { killed: [], failed: [] }
        const answers: Record<string, unknown> = {
          [channels.getSnapshot]: data.snapshot,
          [channels.killInstances]: nothingKilled,
          [channels.closeApps]: nothingKilled,
          [channels.getDocker]: data.docker,
          [channels.stopContainers]: { stopped: [], failed: [] },
          [channels.getSettings]: data.settings,
          [channels.saveSettings]: data.settings,
          [channels.updateState]: data.update
        }
        for (const [channel, answer] of Object.entries(answers)) {
          ipcMain.removeHandler(channel)
          ipcMain.handle(channel, () => answer)
        }
      },
      { channels: IPC, data }
    )
    await launched.page.emulateMedia({ colorScheme: 'dark' })
    await launched.page.reload()
    mkdirSync(SHOTS, { recursive: true })
  })

  test.afterAll(async () => {
    await launched?.close()
  })

  test('captures every tab in dark mode', async () => {
    const { page } = launched
    await expect(page.getByTestId('update-banner')).toBeVisible()
    const tabs = [
      ['projects', 'projects', 'instance-row'],
      ['freeRam', 'free-ram', 'consumer-row'],
      ['docker', 'docker', 'container-row'],
      ['settings', 'settings', 'protected-names']
    ] as const
    for (const [tab, file, ready] of tabs) {
      await page.getByTestId(`tab-${tab}`).click()
      await expect(page.getByTestId(ready).first()).toBeVisible()
      await page.waitForTimeout(600) // let entry animations settle
      await page.screenshot({ path: join(SHOTS, `${file}.png`) })
    }
  })
})
