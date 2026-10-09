import { describe, expect, it } from 'vitest'
import { claudeSessionPid, detectOrigin } from '../../../src/main/core/origin'
import { proc } from '../fixtures'

describe('detectOrigin', () => {
  it('trusts Claude Code child-session variables over the IDE terminal it runs in', () => {
    const env = { CLAUDE_CODE_CHILD_SESSION: '1', TERM_PROGRAM: 'vscode' }
    expect(detectOrigin(env, [])).toBe('claude-code')
  })

  it('does not treat a bare CLAUDECODE=1 as Claude Code', () => {
    expect(detectOrigin({ CLAUDECODE: '1', TERM_PROGRAM: 'vscode' }, [])).toBe('vscode')
  })

  it('tells Cursor apart from VS Code', () => {
    const env = { TERM_PROGRAM: 'vscode', VSCODE_GIT_ASKPASS_NODE: 'C:\\cursor\\Cursor.exe' }
    expect(detectOrigin(env, [])).toBe('cursor')
  })

  it('recognizes JetBrains terminals', () => {
    expect(detectOrigin({ TERMINAL_EMULATOR: 'JetBrains-JediTerm' }, [])).toBe('jetbrains')
  })

  it('falls back to the closest recognizable ancestor', () => {
    const ancestors = [
      proc({ name: 'bash.exe' }),
      proc({ name: 'claude.exe' }),
      proc({ name: 'Code.exe' })
    ]
    expect(detectOrigin(null, ancestors)).toBe('claude-code')
  })

  it('reports a bare interactive shell as a terminal', () => {
    expect(detectOrigin({}, [proc({ name: 'pwsh.exe' })])).toBe('terminal')
  })

  it('is unknown without env or ancestors', () => {
    expect(detectOrigin(null, [])).toBe('unknown')
  })
})

describe('claudeSessionPid', () => {
  it('parses CLAUDE_PID', () => {
    expect(claudeSessionPid({ CLAUDE_PID: '6400' })).toBe(6400)
    expect(claudeSessionPid({ CLAUDE_PID: 'x' })).toBeNull()
    expect(claudeSessionPid(null)).toBeNull()
  })
})
