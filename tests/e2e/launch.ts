import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export const ROOT = resolve(__dirname, '../..')

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  close: () => Promise<void>
}

/** Built app (package.json main → out/main) with a throwaway profile: real settings stay untouched. */
export async function launchApp(): Promise<LaunchedApp> {
  const profile = mkdtempSync(join(tmpdir(), 'localkiller-profile-'))
  const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], cwd: ROOT })
  const page = await app.firstWindow()
  return {
    app,
    page,
    close: async () => {
      await app.close()
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
  }
}

/** The runner may itself run inside Claude Code / an IDE: children get an explicit environment. */
export function cleanEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const inherited = Object.entries(process.env).filter(
    ([key]) =>
      !/^(CLAUDE|AI_AGENT|TERM_PROGRAM|WT_SESSION|TERMINAL_EMULATOR|VSCODE|CURSOR)/i.test(key)
  )
  return { ...Object.fromEntries(inherited), ...extra }
}
