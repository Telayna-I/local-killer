import { useCallback, useEffect, useState } from 'react'
import type { Language, Settings } from '../../../shared/types'
import { resolveLanguage } from '../i18n/translator'

export const DEFAULT_POLL_MS = 3000

export interface SettingsHandle {
  /** null until loaded (or if loading failed). */
  settings: Settings | null
  save: (next: Settings) => Promise<Settings>
  language: Language
}

export function useSettings(): SettingsHandle {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    let active = true
    window.api.getSettings().then(
      (loaded) => active && setSettings(loaded),
      () => undefined // Defaults apply; Settings tab shows the load state.
    )
    return () => {
      active = false
    }
  }, [])

  const save = useCallback(async (next: Settings): Promise<Settings> => {
    const saved = await window.api.saveSettings(next)
    setSettings(saved)
    return saved
  }, [])

  return {
    settings,
    save,
    language: resolveLanguage(settings?.language ?? null, navigator.language)
  }
}
