// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { en } from '@renderer/i18n/en'
import { es } from '@renderer/i18n/es'
import { createTranslator, interpolate, resolveLanguage } from '@renderer/i18n/translator'

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('i18n dictionaries', () => {
  it('es and en have exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('every translation is non-empty and uses the same placeholders', () => {
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(es[key].trim(), key).not.toBe('')
      expect(en[key].trim(), key).not.toBe('')
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]))
    }
  })

  it('plural keys always come in .one/.other pairs', () => {
    const keys = Object.keys(es)
    for (const key of keys.filter((k) => k.endsWith('.one'))) {
      expect(keys).toContain(key.replace(/\.one$/, '.other'))
    }
  })
})

describe('translator', () => {
  it('interpolates {name} and leaves unknown placeholders alone', () => {
    expect(interpolate('Kill {name}?', { name: 'vite' })).toBe('Kill vite?')
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}')
  })

  it('picks the plural form by count', () => {
    const { tn } = createTranslator('es')
    expect(tn('instance.processes', 1)).toBe('1 proceso')
    expect(tn('instance.processes', 3)).toBe('3 procesos')
  })

  it('resolves the language from settings, then the OS locale', () => {
    expect(resolveLanguage('en', 'es-AR')).toBe('en')
    expect(resolveLanguage(null, 'es-AR')).toBe('es')
    expect(resolveLanguage(null, 'pt-BR')).toBe('en')
  })
})
