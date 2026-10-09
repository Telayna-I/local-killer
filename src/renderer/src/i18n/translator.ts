import { createContext, useContext } from 'react'
import type { Language } from '../../../shared/types'
import { en } from './en'
import { es, type MessageKey, type Messages } from './es'

export type Vars = Record<string, string | number>

/** Keys that come in `.one` / `.other` pairs, addressed by their shared prefix. */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}.one` ? Base : never
}[MessageKey]

export interface Translator {
  language: Language
  t(key: MessageKey, vars?: Vars): string
  tn(key: PluralKey, count: number, vars?: Vars): string
}

const DICTIONARIES: Record<Language, Messages> = { es, en }

export function resolveLanguage(preferred: Language | null, navigatorLanguage: string): Language {
  return preferred ?? (navigatorLanguage.toLowerCase().startsWith('es') ? 'es' : 'en')
}

export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  )
}

export function createTranslator(language: Language): Translator {
  const messages = DICTIONARIES[language]
  const t = (key: MessageKey, vars?: Vars): string => interpolate(messages[key], vars)
  return {
    language,
    t,
    tn: (key, count, vars) =>
      t(`${key}.${count === 1 ? 'one' : 'other'}` as MessageKey, { count, ...vars })
  }
}

export const I18nContext = createContext<Translator>(createTranslator('en'))

export function useT(): Translator {
  return useContext(I18nContext)
}
