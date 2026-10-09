import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { expect, test } from '@playwright/test'
import { cleanEnv, launchApp, type LaunchedApp } from './launch'

const SERVER = `const s = require('http').createServer((q, r) => r.end('ok')); s.listen(0, () => process.stdout.write(s.address().port + '\\n'))`

function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' })
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
}

const exited = (child: ChildProcess): boolean =>
  child.exitCode !== null || child.signalCode !== null

// SAFETY: this machine may run real dev servers. The test only ever clicks Kill on the row
// holding the port of the server it spawned, after checking that row is exactly that one PID.
test.describe('kill flow on the real OS', () => {
  let launched: LaunchedApp
  let server: ChildProcess
  let port: number
  let repo: string

  test.beforeAll(async () => {
    repo = realpathSync.native(mkdtempSync(join(tmpdir(), 'localkiller-e2e-')))
    mkdirSync(join(repo, '.git'))
    server = spawn(process.execPath, ['-e', SERVER], {
      cwd: repo,
      env: cleanEnv({ CLAUDE_CODE_CHILD_SESSION: '1' })
    })
    port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject)
      server.stdout?.once('data', (chunk: Buffer) =>
        resolve(Number(chunk.toString().split('\n')[0]))
      )
    })
    launched = await launchApp()
  })

  test.afterAll(async () => {
    await launched?.close()
    if (server && !exited(server)) server.kill()
    rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  })

  test('finds the spawned server under its repo, kills it from the UI and frees the port', async () => {
    const { page } = launched
    const row = page
      .getByTestId('instance-row')
      .filter({ has: page.locator(`[data-port="${port}"]`) })
    await expect(row).toHaveCount(1, { timeout: 45_000 })

    const group = page.getByTestId('repo-group').filter({ has: row })
    await expect(group.locator('h2')).toHaveText(basename(repo))
    await expect(row.locator('[data-origin="claude-code"]')).toBeVisible()

    await row.getByTestId('toggle-details').click()
    await expect(row.getByTestId('instance-pids')).toHaveText(String(server.pid))

    await row.getByTestId('kill-instance').click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(`:${port}`)
    await dialog.getByTestId('confirm-accept').click()

    await expect(row).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByTestId('toast').first()).toBeVisible()
    await expect.poll(() => portIsOpen(port), { timeout: 10_000 }).toBe(false)
    await expect.poll(() => exited(server), { timeout: 10_000 }).toBe(true)
  })
})
