# Worklog

## 2026-10-09 — Bootstrap, Windows provider and core logic (M0–M2)
- Scaffolded electron-vite 5 react-ts; Electron 44.7, Vite 7.3, TS 5.9, koffi 3.3.2, electron-updater,
  Tailwind v4, Vitest 5. Git initialized with the telayna-i identity.
- Windows provider via koffi (D-002): 345 processes + listeners in ~15–40ms, PEB reads for cwd/env
  validated live (found `CLAUDE_CODE_CHILD_SESSION=1` on Claude-launched servers).
- Core: PID-reuse-safe tree, launch-root climbing, orphan detection (lost parent or dead `CLAUDE_PID`),
  origin by env then ancestors, repo root resolution, labels, CPU deltas, protection policy, consumers.
- Main wiring: sandboxed window, typed preload, IPC with sender check + id validation, settings store,
  updater, Docker CLI service, `--smoke` self-test (passes under Electron 44: koffi loads).
- Tests: 40 unit + 2 real integration tests (server with Claude origin detected and killed, port closed;
  orphaned watcher without port detected and killed) green on Windows.
- Live finding on the dev machine: a `vite preview` on :4319 left by another Claude session and a
  Claude-launched `next dev` on :3123 — exactly the problem the app targets.

## 2026-10-09 — UI, macOS/Linux providers, packaging and release pipeline (M3–M6, parallel agents)
- Three agents in parallel on disjoint folders; integrated and reviewed in the main session.
- UI (agent A): Projects grouped by repo with origin/orphan badges, Free RAM (orphans + top consumers),
  Docker, Settings (language, interval, protected list), update banner; typed es/en i18n; native dialogs;
  Playwright E2E kills a spawned server through the UI after verifying its PID. Screenshots use demo data.
- Unix providers (agent B): Linux `/proc`, macOS ps/lsof + koffi libSystem, shared SIGTERM→SIGKILL kill;
  verified on Linux in a node:24 container (unit + integration green); macOS is covered by CI only.
- Packaging (agent C): whitelist files, NSIS one-click per-user, mac dmg+zip x64/arm64 ad-hoc signed,
  AppImage+deb; packaged `--smoke` passes on Windows (koffi unpacked from asar automatically); release
  workflow drafts → builds + smoke per OS → publishes as Latest; README and icon.
- Main-session fixes: lockfile regenerated with a project `.npmrc` (D-012) — the global legacy-peer-deps
  setting had made `npm ci` fail on clean machines; smoke mode skips the single-instance lock; renderer
  minified (730 → 274 kB); versioned interpreters (`python3.12`, `php8.3`) count as dev runtimes; labels use
  the process title when npm/next overwrite argv.

## 2026-10-09 — Safety review fixes and full verification
- Independent review of every kill path found two real issues, both fixed with regression tests:
  - macOS: Electron helpers (`LocalKiller Helper (GPU)`...) are separate binaries, so exact-name self
    protection missed them and "Close" on the LocalKiller consumer row could kill the app's own helpers.
    `ProtectionPolicy` now supports `name*` prefixes; main protects `<exe>` and `<exe> helper*`.
  - `pwsh -NoExit -Command <init>` (VS Code / Windows Terminal) was treated as a one-shot shell, making the
    user's interactive terminal the root of a dev-server instance. `-NoExit` now disqualifies it.
- Renderer tests migrated from a hand-written DOM harness to React Testing Library (peer now installed).
- Verified: typecheck, eslint (0 errors), 137 unit, 2 integration (real OS), Playwright E2E (kills a
  spawned server through the UI), `npm run release:check` (packaged exe `--smoke` → ok:true).

## 2026-10-09 — First CI run: macOS + Linux green, Windows session bug fixed
- Pushed to `Telayna-I/local-killer` (D-013). macos-latest and ubuntu-latest passed everything, including
  the real integration tests — first proof of the macOS provider.
- windows-latest failed the integration test: the runner executes everything in session 0, and
  `isSystem` meant "session 0", so the test's own server was classified as protected. `isSystem` now
  means "a different session than LocalKiller's" — identical on desktops, correct on CI/servers.
- Added `.gitattributes` (`eol=lf`) after a CRLF file triggered prettier warnings on the Windows runner.
