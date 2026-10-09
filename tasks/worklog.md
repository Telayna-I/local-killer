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
