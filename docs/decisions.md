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
