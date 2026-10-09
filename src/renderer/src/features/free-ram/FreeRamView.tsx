import type { Snapshot } from '../../../../shared/types'
import { InstanceSummaryList } from '../../components/InstanceSummaryList'
import { useKillFlow } from '../../hooks/useKillFlow'
import { useT } from '../../i18n/translator'
import { formatBytes } from '../../lib/format'
import { orphanDevInstances, totalMemory } from '../../lib/instances'
import { ConsumersTable } from './ConsumersTable'

export function FreeRamView({
  snapshot,
  refresh
}: {
  snapshot: Snapshot | null
  refresh: () => Promise<void>
}): React.JSX.Element {
  const { t } = useT()
  const kill = useKillFlow(refresh)
  const orphans = orphanDevInstances(snapshot?.instances ?? [])
  const reclaimable = formatBytes(totalMemory(orphans))

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="orphans-title"
        className="overflow-hidden rounded-xl border border-line bg-panel"
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2
              id="orphans-title"
              className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[0.01em]"
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${orphans.length > 0 ? 'animate-signal bg-orphan' : 'bg-line-strong'}`}
              />
              {t('freeRam.orphansTitle')}
            </h2>
            <p className="max-w-xl text-ink-muted">{t('freeRam.orphansBody')}</p>
          </div>
          <p className="flex items-baseline gap-2">
            <span
              data-testid="reclaimable"
              className={`tabular font-display text-[30px] leading-none font-semibold ${orphans.length > 0 ? 'text-orphan' : 'text-ink-faint'}`}
            >
              {reclaimable}
            </span>
            <span className="text-[12px] text-ink-faint">{t('freeRam.reclaimable')}</span>
          </p>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {orphans.length > 0 ? (
            <>
              <InstanceSummaryList instances={orphans} />
              <button
                type="button"
                data-testid="kill-orphans"
                onClick={() => void kill(orphans)}
                className="h-9 self-end rounded-md bg-kill px-4 font-semibold text-on-accent transition hover:brightness-110"
              >
                {t('freeRam.killOrphans', { memory: reclaimable })}
              </button>
            </>
          ) : (
            <p className="py-2 text-ink-muted">{t('freeRam.noOrphans')}</p>
          )}
        </div>
      </section>

      <ConsumersTable consumers={snapshot?.topConsumers ?? []} refresh={refresh} />
    </div>
  )
}
