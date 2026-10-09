# LocalKiller — TODO

## Next steps
- M0 in progress: scaffold + tooling + project memory.

## M0 — Bootstrap
- [ ] Scaffold electron-vite react-ts, git init with telayna-i identity
- [ ] Bump deps (Electron 44, Vite 7.3, TS 5.9), add koffi, electron-updater, Tailwind v4, Vitest, Playwright
- [ ] Sandbox on, CSP, typed preload API
- [ ] Project memory: tasks/*, docs/decisions.md, docs/architecture.md
- [ ] CI test workflow (win/mac/linux)

## M1 — Windows provider
- [ ] koffi bindings: Toolhelp32, process times/memory, cmdline, PEB cwd/env, TCP listeners
- [ ] `npm run scan` JSON dump
- [ ] Packaged smoke run proves koffi loads from asar

## M2 — Core logic
- [ ] tree (PID reuse safe), orphans, classify, launch-root, repo-root, origin, label, protect, cpu, snapshot
- [ ] kill-service with identity validation
- [ ] Unit tests + real integration test green on Windows

## M3 — UI
- [ ] Instance list grouped by repo, kill flow, confirm dialog, settings (protected list, language, interval)
- [ ] i18n es/en
- [ ] Playwright E2E happy path

## M4 — macOS + Linux providers
- [ ] darwin: ps/lsof/sysctl KERN_PROCARGS2
- [ ] linux: /proc
- [ ] Integration matrix green on 3 OSes

## M5 — Panels
- [ ] Free RAM: kill orphans + top consumers by app
- [ ] Docker containers + stop

## M6 — Release
- [ ] electron-builder targets + release workflow
- [ ] Updater UI (mac: manual download)
- [ ] Ship v0.1.0 → v0.1.1, confirm Windows auto-update
