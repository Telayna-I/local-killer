import type { ProcessProvider } from './types'

let provider: Promise<ProcessProvider> | null = null

/** Loaded lazily: each provider binds OS libraries at import time (kernel32.dll, libc...). */
export function getProvider(): Promise<ProcessProvider> {
  provider ??= loadProvider()
  return provider
}

async function loadProvider(): Promise<ProcessProvider> {
  switch (process.platform) {
    case 'win32':
      return (await import('./win32')).win32Provider
    default:
      throw new Error(`Unsupported platform: ${process.platform}`)
  }
}
