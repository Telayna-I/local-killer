# LocalKiller — TODO

## Next steps
- User installs v0.1.0 on Windows; then bump to 0.1.1, tag, and confirm the in-app update banner + restart.
- Optional later: Apple Developer ID signing to enable silent macOS updates.

## M0 — Bootstrap
- [x] Scaffold electron-vite react-ts, git init with telayna-i identity
- [x] Bump deps (Electron 44, Vite 7.3, TS 5.9), add koffi, electron-updater, Tailwind v4, Vitest, Playwright
- [x] Sandbox on, CSP, typed preload API
- [x] Project memory: tasks/*, docs/decisions.md, docs/architecture.md
- [x] CI test workflow (win/mac/linux) (runs on first push)

## M1 — Windows provider
- [x] koffi bindings: Toolhelp32, process times/memory, cmdline, PEB cwd/env, TCP listeners
- [x] `npm run scan`
- [x] `--smoke` passes under Electron 44 (unpackaged)
- [x] Packaged smoke run proves koffi loads from the packaged app (Windows)

## M2 — Core logic
- [x] tree (PID reuse safe), orphans, classify, launch-root, repo-root, origin, label, protect, cpu, snapshot
- [x] kill-service with identity validation
- [x] Unit tests + real integration test green on Windows

## M3 — UI
- [x] Instance list grouped by repo, kill flow, confirm dialog, settings (protected list, language, interval)
- [x] i18n es/en
- [x] Playwright E2E happy path

## M4 — macOS + Linux providers
- [x] darwin: ps/lsof/libproc/sysctl KERN_PROCARGS2 (unverified until macos-latest CI)
- [x] linux: /proc (verified in a node:24 container)
- [x] Integration matrix green on 3 OSes

## M5 — Panels
- [x] Backend: kill orphans (killInstances) + top consumers (closeApps), Docker service
- [x] UI panels

## M6 — Release
- [x] electron-builder targets + release workflow (Windows installer built locally)
- [x] Updater (mac: manual download link)
- [x] Ship v0.1.0 (all OS packages smoke-tested in CI)
- [ ] Ship v0.1.1 and confirm an installed v0.1.0 auto-updates on Windows
