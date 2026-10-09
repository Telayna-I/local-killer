const MB = 1024 * 1024
const GB = 1024 * MB

/** `512 MB`, `1.5 GB`. Binary units with the familiar labels, like Task Manager and Activity Monitor. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
  if (bytes < MB / 2) return '<1 MB'
  return `${Math.round(bytes / MB)} MB`
}

/** `45 s`, `12 min`, `2 h 5 min`, `3 d`. */
export function formatUptime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`
  return `${Math.floor(hours / 24)} d`
}

/** `0%`, `<0.1%`, `4.2%`, `37%`. */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  if (value < 0.1) return '<0.1%'
  if (value < 10) return `${value.toFixed(1)}%`
  return `${Math.round(value)}%`
}

export function formatClock(timestamp: number, language: string): string {
  return new Date(timestamp).toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/** Electron wraps IPC errors as "Error invoking remote method 'x': Error: msg"; keep only msg. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '')
}
