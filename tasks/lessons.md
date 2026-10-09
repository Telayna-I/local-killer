# Lessons

Patterns learned from corrections. Review at session start.

## 2026-10-09 — Never edit regexes or backslash paths through `node -e` / heredoc replacements
`node -e "...replace(...)"` inside bash mangled `\s`, `\b` (became a backspace) and `C:\Windows` twice.
Rule: for code containing backslashes use the Edit tool, or a script file whose literals use `String.raw`.
Always grep the result with `cat -A` (or rerun lint/tests) right after such an edit.
