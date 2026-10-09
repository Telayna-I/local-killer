import type { Snapshot } from '../../../shared/types'
import { useT } from '../i18n/translator'
import { formatClock } from '../lib/format'
import { MarkIcon, RefreshIcon } from './icons'
import { MemoryMeter } from './MemoryMeter'
import { UpdateBanner } from './UpdateBanner'

export function Header({
  snapshot,
  error,
  onRefresh
}: {
  snapshot: Snapshot | null
  error: string | null
  onRefresh: () => void
}): React.JSX.Element {
  const { t, language } = useT()

  return (
    <header className="border-b border-line bg-panel">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-kill text-on-accent shadow-[0_0_18px_-4px_var(--lk-kill)]">
            <MarkIcon width={17} height={17} />
          </span>
          <h1 className="font-display text-[17px] font-semibold tracking-[0.02em]">
            Local<span className="text-kill">Killer</span>
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-5">
          <MemoryMeter memory={snapshot?.memory ?? null} />
          <div className="flex items-center gap-2 text-[12px] text-ink-muted">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${error ? 'bg-kill' : snapshot ? 'bg-ok' : 'bg-ink-faint'}`}
            />
            {error ? (
              <span role="alert" className="max-w-64 truncate text-kill" title={error}>
                {t('header.scanError', { message: error })}
              </span>
            ) : (
              snapshot && (
                <span className="tabular whitespace-nowrap" data-testid="last-refresh">
                  {t('header.updatedAt', { time: formatClock(snapshot.takenAt, language) })}
                </span>
              )
            )}
            <button
              type="button"
              onClick={onRefresh}
              aria-label={t('header.refresh')}
              title={t('header.refresh')}
              className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-raised hover:text-ink"
            >
              <RefreshIcon width={14} height={14} />
            </button>
          </div>
        </div>
      </div>
      <UpdateBanner />
    </header>
  )
}
