import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, parse } from 'node:path'

export interface RepoInfo {
  root: string
  name: string
}

const MANIFESTS = [
  'package.json',
  'composer.json',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'pom.xml',
  'build.gradle',
  'deno.json'
]

const CACHE_TTL_MS = 30_000

/** Walks up from `start`; the nearest `.git` wins, else the nearest manifest (never home or drive root). */
export class RepoResolver {
  private readonly cache = new Map<string, { value: RepoInfo | null; at: number }>()

  constructor(
    private readonly exists: (path: string) => boolean = existsSync,
    private readonly home: string = homedir()
  ) {}

  resolve(start: string | null): RepoInfo | null {
    if (start === null || !isAbsolute(start)) return null
    const cached = this.cache.get(start)
    if (cached !== undefined && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
    const value = this.walk(start)
    this.cache.set(start, { value, at: Date.now() })
    return value
  }

  private walk(start: string): RepoInfo | null {
    let manifestRoot: string | null = null
    for (let dir = start; ; dir = dirname(dir)) {
      if (this.exists(join(dir, '.git'))) return { root: dir, name: basename(dir) }
      const isBoundary = dir === this.home || dir === parse(dir).root
      if (
        manifestRoot === null &&
        !isBoundary &&
        MANIFESTS.some((m) => this.exists(join(dir, m)))
      ) {
        manifestRoot = dir
      }
      if (dirname(dir) === dir) break
    }
    return manifestRoot === null ? null : { root: manifestRoot, name: basename(manifestRoot) }
  }
}

/**
 * When cwd is unreadable, guesses a directory from the first absolute path in the command line
 * (`node C:\proj\node_modules\vite\bin\vite.js` → `C:\proj`).
 */
export function directoryFromCommandLine(tokens: string[]): string | null {
  for (const token of tokens.slice(1)) {
    if (!isAbsolute(token)) continue
    const modules = token.search(/[\\/]node_modules[\\/]/)
    return modules >= 0 ? token.slice(0, modules) : dirname(token)
  }
  return null
}
