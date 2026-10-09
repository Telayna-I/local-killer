import { describe, expect, it } from 'vitest'
import { describeCommand, tokenize } from '../../../src/main/core/label'

describe('tokenize', () => {
  it('keeps quoted groups, including quotes in the middle of a token', () => {
    expect(tokenize('"C:\\Program Files\\app.exe" --dir="C:\\a b" run')).toEqual([
      'C:\\Program Files\\app.exe',
      '--dir=C:\\a b',
      'run'
    ])
  })
})

describe('describeCommand', () => {
  it.each([
    [
      'node.exe',
      '"node" "C:\\p\\node_modules\\.bin\\..\\vite\\bin\\vite.js" preview --config x',
      'vite preview'
    ],
    ['node', 'node /p/node_modules/next/dist/bin/next dev -p 3000', 'next dev'],
    ['node.exe', 'node C:\\nvm\\node_modules\\npm\\bin\\npm-cli.js run dev', 'npm run dev'],
    ['node', 'node /p/node_modules/@nestjs/cli/bin/nest.js start', '@nestjs/cli start'],
    ['node', 'node server.js', 'server.js'],
    ['php.exe', 'php artisan serve --port=8001', 'artisan serve'],
    ['php.exe', 'php -S 127.0.0.1:8001 -t public', 'php -S 127.0.0.1:8001'],
    ['python', 'python -m uvicorn app:main --reload', 'uvicorn app:main'],
    ['python3', 'python3 manage.py runserver', 'manage.py runserver'],
    ['Discord.exe', '"C:\\x\\Discord.exe" --type=renderer', 'discord']
  ])('%s %s → %s', (name, commandLine, expected) => {
    expect(describeCommand(name, commandLine)).toBe(expected)
  })

  it('falls back to the runtime name when the command line is unknown', () => {
    expect(describeCommand('node.exe', null)).toBe('node')
  })
})
