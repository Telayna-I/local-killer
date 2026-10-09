import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Language, Settings } from '../../shared/types'
import { DEFAULT_PROTECTED_NAMES } from '../core/protect'

export const DEFAULT_SETTINGS: Settings = {
  language: null,
  pollIntervalMs: 3000,
  protectedNames: DEFAULT_PROTECTED_NAMES
}

const MIN_POLL_MS = 1000
const MAX_POLL_MS = 60_000
const MAX_PROTECTED_NAMES = 200
const MAX_NAME_LENGTH = 100
const LANGUAGES: Language[] = ['es', 'en']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Settings come from the renderer or from disk: both are untrusted, so every field is checked. */
export function sanitizeSettings(input: unknown): Settings {
  const raw = isRecord(input) ? input : {}
  const language = LANGUAGES.find((l) => l === raw.language) ?? null
  const poll = Number(raw.pollIntervalMs)
  const pollIntervalMs = Number.isFinite(poll)
    ? Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, Math.round(poll)))
    : DEFAULT_SETTINGS.pollIntervalMs
  const names = Array.isArray(raw.protectedNames)
    ? raw.protectedNames
        .filter((n): n is string => typeof n === 'string')
        .map((n) => n.trim().toLowerCase())
        .filter((n) => n.length > 0 && n.length <= MAX_NAME_LENGTH)
    : DEFAULT_SETTINGS.protectedNames
  return {
    language,
    pollIntervalMs,
    protectedNames: [...new Set(names)].slice(0, MAX_PROTECTED_NAMES)
  }
}

export class SettingsStore {
  private current: Settings

  constructor(private readonly file: string) {
    this.current = this.load()
  }

  get(): Settings {
    return this.current
  }

  save(input: unknown): Settings {
    this.current = sanitizeSettings(input)
    mkdirSync(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.tmp`
    writeFileSync(temporary, JSON.stringify(this.current, null, 2))
    renameSync(temporary, this.file)
    return this.current
  }

  private load(): Settings {
    try {
      return sanitizeSettings(JSON.parse(readFileSync(this.file, 'utf8')))
    } catch {
      return DEFAULT_SETTINGS
    }
  }
}
