// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { errorMessage, formatBytes, formatPercent, formatUptime } from '@renderer/lib/format'

const MB = 1024 * 1024

describe('formatBytes', () => {
  it('uses whole MB below 1 GB and one decimal in GB', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(100 * 1024)).toBe('<1 MB')
    expect(formatBytes(512 * MB)).toBe('512 MB')
    expect(formatBytes(1023.4 * MB)).toBe('1023 MB')
    expect(formatBytes(1024 * MB)).toBe('1.0 GB')
    expect(formatBytes(1.55 * 1024 * MB)).toBe('1.6 GB')
  })

  it('treats invalid input as nothing', () => {
    expect(formatBytes(Number.NaN)).toBe('0 MB')
    expect(formatBytes(-5)).toBe('0 MB')
  })
})

describe('formatUptime', () => {
  const minute = 60_000
  const hour = 60 * minute

  it('scales from seconds to days', () => {
    expect(formatUptime(-1000)).toBe('0 s')
    expect(formatUptime(45_000)).toBe('45 s')
    expect(formatUptime(12 * minute + 30_000)).toBe('12 min')
    expect(formatUptime(2 * hour + 5 * minute)).toBe('2 h 5 min')
    expect(formatUptime(3 * hour)).toBe('3 h')
    expect(formatUptime(3 * 24 * hour + 7 * hour)).toBe('3 d')
  })
})

describe('formatPercent', () => {
  it('keeps one decimal for small values and rounds big ones', () => {
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.04)).toBe('<0.1%')
    expect(formatPercent(4.25)).toBe('4.3%')
    expect(formatPercent(37.6)).toBe('38%')
    expect(formatPercent(Number.NaN)).toBe('0%')
  })
})

describe('errorMessage', () => {
  it('strips the Electron IPC wrapper', () => {
    const error = new Error("Error invoking remote method 'instances:kill': Error: Invalid id list")
    expect(errorMessage(error)).toBe('Invalid id list')
    expect(errorMessage('plain')).toBe('plain')
  })
})
