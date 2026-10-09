import type { SystemMemory } from '../../../shared/types'
import { useT } from '../i18n/translator'
import { formatBytes } from '../lib/format'

/** Segmented "instrument" bar of system RAM in use; turns amber at 75% and red at 90%. */
export function MemoryMeter({ memory }: { memory: SystemMemory | null }): React.JSX.Element {
  const { t } = useT()
  const total = memory?.totalBytes ?? 0
  const used = memory ? Math.max(0, total - memory.freeBytes) : 0
  const ratio = total > 0 ? used / total : 0
  const fill = ratio >= 0.9 ? 'bg-kill' : ratio >= 0.75 ? 'bg-orphan' : 'bg-port'
  const valueText = t('header.memoryValue', { used: formatBytes(used), total: formatBytes(total) })

  return (
    <div className="flex items-center gap-3" data-testid="memory-meter">
      <span className="font-display text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase">
        RAM
      </span>
      <div
        role="meter"
        aria-label={t('header.memory')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={used}
        aria-valuetext={memory ? valueText : t('common.loading')}
        className="relative h-2.5 w-36 overflow-hidden rounded-[3px] bg-line-strong/60"
      >
        <div
          className={`h-full transition-[width] duration-700 ease-out ${fill}`}
          style={{ width: `${(ratio * 100).toFixed(1)}%` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_5px,var(--lk-panel)_5px_7px)]"
        />
      </div>
      <span className="tabular font-mono text-[12px] whitespace-nowrap text-ink">
        {memory ? (
          <>
            {formatBytes(used)}
            <span className="text-ink-faint"> / {formatBytes(total)}</span>
            <span className="ml-2 text-ink-muted">{Math.round(ratio * 100)}%</span>
          </>
        ) : (
          '—'
        )}
      </span>
    </div>
  )
}
