# Decisions

## D-001 — Electron + electron-vite + React/TS
Desktop app installable on Windows, macOS and Linux. electron-vite 5 (react-ts template) with Vite 7.3,
TypeScript 5.9 strict, electron-builder for packaging.
Alternatives discarded: Tauri (user asked for Electron), Vite 8 (electron-vite 5 supports up to Vite 7).

## D-002 — Windows process data via koffi FFI, no PowerShell/netstat
Toolhelp32, GetProcessTimes, K32GetProcessMemoryInfo, NtQueryInformationProcess and GetExtendedTcpTable
called in-process through koffi (prebuilt binaries, no node-gyp).
Why: `Get-CimInstance` costs ~0.8s per poll, WMIC is removed from recent Windows 11, and netstat output is
localized (Spanish headers on the dev machine). Reading cwd/env of another process has no CLI equivalent
on Windows; it requires reading the target PEB.
Alternatives discarded: systeminformation (PowerShell-based, no cwd/env), native C++ addon (build matrix).

## D-003 — Origin detection by environment variables first
Claude Code exports `CLAUDE_CODE_CHILD_SESSION=1`, `AI_AGENT=claude-code_*` and `CLAUDE_PID` to commands it
runs. Reading the target process env survives the death of the parent, which the parent-chain approach does
not. `CLAUDECODE=1` alone is not trusted (IDE extensions set it too). Fallback: walk living ancestors.

## D-004 — Never use `taskkill /T`
It follows stale parent PIDs and can kill unrelated processes after PID reuse. LocalKiller computes its own
tree (a parent link is valid only if the parent started before the child) and kills leaves first, verifying
pid + start time right before each kill (on Windows, through the same handle used to terminate).

## D-005 — One instance per launch root, grouped by repo in the UI
A "project instance" is the topmost living wrapper/shell/runtime above a listener or orphan dev process.
The renderer groups instances by repo root. Lets a repo run e.g. an orphaned vite and a live artisan serve
and kill them independently or together.

## D-006 — Auto-update via electron-updater + public GitHub repo
Public repo `telayna-i/localkiller` so the updater needs no embedded token. Windows NSIS (unsigned) and Linux
AppImage/deb auto-update; macOS is unsigned for now, so it shows a manual download link instead
(Squirrel.Mac requires a Developer ID signature).

## D-007 — Hand-rolled i18n
Typed `es`/`en` dictionaries and a `useT()` hook. No i18next: two languages and a flat key set don't need it.

## D-008 — Self-protection = launcher chain + own executable name
LocalKiller never kills itself or whoever launched it (in dev: electron-vite, npm, the terminal, Claude).
Its pid and living ancestors are protected by pid; Electron's helper processes by the app executable name.
Alternative discarded: protecting the app's whole subtree — it would also protect processes a test or a
parent legitimately spawned and wants killed.

## D-009 — Packaging: whitelist files, ad-hoc mac signing, one-click per-user NSIS
electron-builder `files` is a whitelist (`out/**`, `resources/**`); koffi's `.node` is unpacked from the asar
automatically. macOS uses `identity: '-'` (ad-hoc) with hardened runtime off: without a Developer ID,
library validation would reject Electron Framework and koffi.node, and arm64 needs at least ad-hoc signing.
Windows NSIS one-click per-user (no admin prompt, auto-update friendly). Linux AppImage + deb (snap dropped).

## D-010 — Release pipeline: draft first, packaged smoke test per OS, publish as Latest
On a `v*` tag CI checks tag == package.json version, creates the draft once (avoids racing duplicate drafts),
builds on windows/macos/ubuntu, runs the packaged app with `--smoke` before uploading, then publishes the
release as Latest (electron-updater reads `/releases/latest`). macOS builds x64 + arm64 in one invocation
with both koffi darwin packages installed so a single `latest-mac.yml` lists both.

## D-011 — Unix providers: pure /proc on Linux, ps/lsof + libSystem (koffi) on macOS
Linux reads everything from `/proc` (no spawning, no locale issues); names come from the `exe` link because
Node 24 renames its main thread (`comm` reads `MainThread`). macOS uses `ps` with `LC_ALL=C TZ=UTC` (same
parser for listing and identity checks, so start times compare equal), `lsof -F` for listeners, and koffi on
libSystem for `proc_pidpath`, cwd (`proc_pidinfo`) and argv/env (`KERN_PROCARGS2`), falling back to ps/lsof.
Kill: SIGTERM leaves-first → wait → SIGKILL, identity re-checked before each signal; never pid <= 1.

## D-012 — Project `.npmrc` with `legacy-peer-deps=false`
The developer's global `~/.npmrc` sets `legacy-peer-deps=true`, which produced a lockfile that `npm ci` rejects
on clean machines (missing peers such as `@testing-library/dom`). The project file pins the default so the
lockfile stays reproducible in CI regardless of the local machine.

## D-013 — Release repo is `Telayna-I/local-killer` (supersedes the repo name in D-006)
The user created the public repo as `Telayna-I/local-killer`. Publish config, updater fallback URL, package
metadata and README point there. Everything else in D-006 stands.

## D-014 — Instance members stop at other roots, interactive shells and protected processes
An instance is its launch root plus descendants, but traversal stops at the root of another instance,
at interactive shells and at protected processes. Supersedes the "merge nested roots into the bigger
subtree" rule from D-005, which let a listening ancestor hide and co-kill dev servers below it.

## D-015 — macOS x64 is smoke-tested on an Intel runner, not under Rosetta
The x64 app segfaults without output under Rosetta on GitHub's arm64 macOS VMs while the arm64 app passes.
That environment says nothing about real Intel Macs, so the release workflow smoke-tests x64 on
`macos-15-intel`, and publishing waits for it. Builds still happen in one invocation on macos-latest so
a single `latest-mac.yml` lists both archs. Amends D-010.
