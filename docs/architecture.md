# Architecture

LocalKiller is an Electron app (electron-vite, React 19, TypeScript strict) that lists everything
running on localhost, groups it by repo, shows who launched it and what it consumes, and kills it.

## Process model

```
renderer (React, sandboxed)  ──window.api (preload, contextBridge)──▶  main (Node)
                                                                         │
             ipc/register.ts: sender check + input validation ◀──────────┘
                     │
   core/snapshot.ts ─┼─ platform provider (win32 | darwin | linux) ── OS
   core/kill-service ┘   docker/docker.ts ── docker CLI
   settings/settings.ts ── userData/settings.json      updater.ts ── GitHub Releases
```

## Modules

| Path | Responsibility |
|---|---|
| `src/shared/types.ts`, `ipc-contract.ts` | View types and the typed IPC API shared by main, preload, renderer |
| `src/main/platform/types.ts` | `ProcessProvider` contract: processes, listeners, details (cwd/env), terminate |
| `src/main/platform/win32/*` | koffi FFI: Toolhelp32, GetProcessTimes, NtQueryInformationProcess, PEB reads, GetExtendedTcpTable, TerminateProcess |
| `src/main/platform/darwin/*` | `ps` (LC_ALL=C, TZ=UTC) + `lsof` for listeners; koffi on libSystem: `proc_pidpath`, `proc_pidinfo` (cwd), `sysctl KERN_PROCARGS2` (argv/env); ps/lsof fallback |
| `src/main/platform/linux/*` | Pure `/proc`: stat/statm/cmdline/exe, `/proc/net/tcp{,6}` + socket inode → pid, cwd/environ |
| `src/main/platform/unix/kill.ts` | SIGTERM leaves-first → wait → SIGKILL survivors, identity re-checked before every signal |
| `src/main/platform/parse/*` | Pure parsers (Windows TCP tables, env blocks, procfs, ps/lsof output, argv), unit tested on every OS |
| `src/main/core/tree.ts` | PID-reuse-safe process tree (parent must start before child) |
| `src/main/core/classify.ts` | Dev runtimes, shells, one-shot shells, init-like parents |
| `src/main/core/launch-root.ts` | Climbs wrappers to the instance root; orphan test |
| `src/main/core/origin.ts` | Origin from env vars, then living ancestors |
| `src/main/core/repo-root.ts` | cwd → nearest `.git` (else manifest), cached |
| `src/main/core/label.ts` | Human label from the command line (`vite`, `npm run dev`, `artisan serve`) |
| `src/main/core/instances.ts` | Seeds (listeners + lost dev runtimes) → instances with ports, pids, RAM, CPU |
| `src/main/core/consumers.ts` | Top RAM consumers aggregated by app |
| `src/main/core/snapshot.ts` | Orchestrates a poll; caches cwd/env per pid+start; keeps the id index |
| `src/main/core/kill-service.ts` | Re-validates ids, identity and protection on a fresh tree, then terminates |
| `src/main/docker/*` | `docker ps` with published ports + compose labels; `docker stop` |
| `src/main/settings/settings.ts` | Validated, atomically written settings |
| `src/main/updater.ts` | electron-updater; macOS (unsigned) gets a manual download link |
| `src/main/smoke.ts` | `--smoke`: packaged build self-test (loads the native layer, takes a snapshot) |
| `src/renderer/src/features/*` | Tabs: projects (grouped by repo), free-ram (orphans + top consumers), docker, settings |
| `src/renderer/src/hooks/*` | `usePolling` (visible-only, non-overlapping), snapshot/docker/settings/update hooks, kill flow |
| `src/renderer/src/i18n/*` | Typed `es`/`en` dictionaries, `useT()` with interpolation and plurals |
| `src/renderer/src/feedback/*` | Native `<dialog>` confirmations and toasts |
| `build/smoke-packaged.mjs` | Runs the unpacked app with `--smoke` for the current OS/arch (local + CI) |
| `.github/workflows/test.yml` | Typecheck, lint, unit, real integration tests on windows/macos/ubuntu |
| `.github/workflows/release.yml` | On `v*` tag: draft → build + packaged smoke per OS → publish as Latest |

## Data flow of one poll
1. Provider lists processes (pid, ppid, name, start time, CPU time, RAM, cmdline) and TCP listeners.
2. Processes worth inspecting (listeners + dev runtimes, never protected) get cwd/env read once per pid+start.
3. Seeds = listeners + dev runtimes whose parent is gone or whose `CLAUDE_PID` session died.
4. Each seed climbs to its launch root; roots become instances with their subtree, ports, repo, origin.
5. The renderer receives views only. Kill requests send back ids; main resolves them against its own index.

## Testing
- `npm test`: unit tests (fixtures, any OS).
- `npm run test:integration`: spawns real servers/orphans in a temp git repo, detects and kills them.
- `npm run test:e2e`: builds, launches the real app with Playwright, kills a spawned server through the UI.
- `npm run release:check`: packages for this OS and runs the packaged smoke test.
- `npm run scan`: prints what the app would show on this machine.
