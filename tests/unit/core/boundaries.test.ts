import { describe, expect, it } from 'vitest'
import { parseDockerPs } from '../../../src/main/docker/parse'
import { assertIdList } from '../../../src/main/ipc/validate'
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../../src/main/settings/settings'

describe('sanitizeSettings', () => {
  it('falls back to defaults for garbage input', () => {
    expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps the poll interval and rejects unknown languages', () => {
    expect(sanitizeSettings({ pollIntervalMs: 5, language: 'fr' })).toMatchObject({
      pollIntervalMs: 1000,
      language: null
    })
    expect(sanitizeSettings({ pollIntervalMs: 10 ** 9, language: 'en' })).toMatchObject({
      pollIntervalMs: 60_000,
      language: 'en'
    })
  })

  it('normalizes and deduplicates protected names, dropping non-strings', () => {
    const settings = sanitizeSettings({
      protectedNames: [' MySQLd ', 'mysqld', 42, '', 'x'.repeat(101)]
    })
    expect(settings.protectedNames).toEqual(['mysqld'])
  })
})

describe('assertIdList', () => {
  it('accepts a list of short strings', () => {
    expect(assertIdList(['1-2', '3-4'])).toEqual(['1-2', '3-4'])
  })

  it.each([['not a list'], [[1]], [['']], [['x'.repeat(201)]], [Array(501).fill('a')]])(
    'rejects %#',
    (value) => {
      expect(() => assertIdList(value)).toThrow()
    }
  )
})

describe('parseDockerPs', () => {
  it('parses tab separated rows including compose labels with commas', () => {
    const output =
      'abc\tshop-db-1\tpostgres:16\t0.0.0.0:5432->5432/tcp\tUp 2 hours\tshop\tC:\\work\\shop, v2\n' +
      'def\tlone\tredis\t\tUp 1 minute\t\t\n'
    expect(parseDockerPs(output)).toEqual([
      {
        id: 'abc',
        name: 'shop-db-1',
        image: 'postgres:16',
        ports: '0.0.0.0:5432->5432/tcp',
        status: 'Up 2 hours',
        composeProject: 'shop',
        workingDir: 'C:\\work\\shop, v2'
      },
      {
        id: 'def',
        name: 'lone',
        image: 'redis',
        ports: '',
        status: 'Up 1 minute',
        composeProject: null,
        workingDir: null
      }
    ])
  })
})
