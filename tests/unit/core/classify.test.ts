import { describe, expect, it } from 'vitest'
import { isDevRuntime, isTransientShell } from '../../../src/main/core/classify'
import { ProtectionPolicy, selfProtectedNames } from '../../../src/main/core/protect'
import { proc } from '../fixtures'

describe('isDevRuntime', () => {
  it.each(['node.exe', 'Node', 'python3.12', 'php8.3', 'ruby3.3', 'bun'])(
    '%s is a dev runtime',
    (name) => {
      expect(isDevRuntime(proc({ name }))).toBe(true)
    }
  )

  it.each(['chrome.exe', 'python-config', 'Discord'])('%s is not', (name) => {
    expect(isDevRuntime(proc({ name }))).toBe(false)
  })
})

describe('isTransientShell', () => {
  it.each([
    ['cmd.exe', 'C:\\Windows\\system32\\cmd.exe /d /s /c "vite"', true],
    ['bash', 'bash -lc "npm run dev"', true],
    ['pwsh.exe', 'pwsh -Command npm run dev', true],
    ['pwsh.exe', 'pwsh -NoLogo', false],
    ['pwsh.exe', 'pwsh.exe -NoExit -Command ". shellIntegration.ps1"', false],
    ['powershell.exe', 'powershell -noexit -c init.ps1', false],
    ['bash', 'bash', false]
  ])('%s %s → %s', (name, commandLine, expected) => {
    expect(isTransientShell(proc({ name, commandLine }))).toBe(expected)
  })
})

describe('ProtectionPolicy', () => {
  const policy = new ProtectionPolicy(
    ['mysqld', ...selfProtectedNames('LocalKiller')],
    new Set([7])
  )

  it.each([
    ['mysqld.exe', true],
    ['LocalKiller', true],
    ['LocalKiller.exe', true],
    ['LocalKiller Helper (GPU)', true],
    ['LocalKiller Helper (Renderer)', true],
    ['localkillerx', false],
    ['node', false]
  ])('%s protected: %s', (name, expected) => {
    expect(policy.isProtected(proc({ name }))).toBe(expected)
  })

  it('protects by pid and system ownership', () => {
    expect(policy.isProtected(proc({ pid: 7, name: 'node' }))).toBe(true)
    expect(policy.isProtected(proc({ name: 'node', isSystem: true }))).toBe(true)
  })
})
