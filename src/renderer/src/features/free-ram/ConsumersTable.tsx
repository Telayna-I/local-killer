import type { ConsumerView } from '../../../../shared/types'
import { LockIcon } from '../../components/icons'
import { useConfirm, useToast } from '../../feedback/context'
import { useT } from '../../i18n/translator'
import { errorMessage, formatBytes, formatPercent } from '../../lib/format'
import { summarizeKill } from '../../lib/results'

const cell = 'px-3 py-2'
const headCell = `${cell} font-display text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase`

export function ConsumersTable({
  consumers,
  refresh
}: {
  consumers: ConsumerView[]
  refresh: () => Promise<void>
}): React.JSX.Element {
  const translator = useT()
  const { t } = translator
  const confirm = useConfirm()
  const notify = useToast()
  const heaviest = Math.max(1, ...consumers.map((consumer) => consumer.memoryBytes))

  const close = async (consumer: ConsumerView): Promise<void> => {
    const confirmed = await confirm({
      title: t('freeRam.closeTitle', { name: consumer.name }),
      body: t('freeRam.closeBody', { count: consumer.processCount }),
      confirmLabel: t('freeRam.close')
    })
    if (!confirmed) return
    try {
      notify(summarizeKill(await window.api.closeApps([consumer.id]), 'closed', translator))
    } catch (error) {
      notify({ tone: 'error', title: t('result.error', { message: errorMessage(error) }) })
    }
    await refresh()
  }

  return (
    <section
      aria-labelledby="consumers-title"
      className="overflow-hidden rounded-xl border border-line bg-panel"
    >
      <div className="flex flex-col gap-1 border-b border-line px-5 py-4">
        <h2
          id="consumers-title"
          className="font-display text-[15px] font-semibold tracking-[0.01em]"
        >
          {t('freeRam.consumersTitle')}
        </h2>
        <p className="text-ink-muted">{t('freeRam.consumersBody')}</p>
      </div>
      <table className="w-full table-fixed border-collapse text-left">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={`${headCell} w-auto pl-5`}>
              {t('freeRam.app')}
            </th>
            <th scope="col" className={`${headCell} w-24 text-right`}>
              {t('freeRam.processes')}
            </th>
            <th scope="col" className={`${headCell} w-52`}>
              {t('instance.ram')}
            </th>
            <th scope="col" className={`${headCell} w-20 text-right`}>
              {t('instance.cpu')}
            </th>
            <th scope="col" className={`${headCell} w-28`}>
              <span className="sr-only">{t('freeRam.close')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {consumers.map((consumer) => (
            <tr key={consumer.id} data-testid="consumer-row" className="hover:bg-raised/60">
              <td className={`${cell} pl-5`}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-ink">{consumer.name}</span>
                  {consumer.isProtected && (
                    <LockIcon width={12} height={12} className="shrink-0 text-ink-faint" />
                  )}
                </span>
              </td>
              <td className={`${cell} tabular text-right font-mono text-[12.5px] text-ink-muted`}>
                {consumer.processCount}
              </td>
              <td className={cell}>
                <span className="flex items-center gap-3">
                  <span className="tabular w-16 shrink-0 text-right font-mono text-[12.5px] text-ink">
                    {formatBytes(consumer.memoryBytes)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
                  >
                    <span
                      className="block h-full rounded-full bg-ink-faint"
                      style={{ width: `${(consumer.memoryBytes / heaviest) * 100}%` }}
                    />
                  </span>
                </span>
              </td>
              <td className={`${cell} tabular text-right font-mono text-[12.5px] text-ink-muted`}>
                {formatPercent(consumer.cpuPercent)}
              </td>
              <td className={`${cell} pr-4 text-right`}>
                <button
                  type="button"
                  disabled={consumer.isProtected}
                  title={consumer.isProtected ? t('freeRam.protectedHint') : undefined}
                  aria-label={t('freeRam.closeLabel', { name: consumer.name })}
                  onClick={() => void close(consumer)}
                  className="h-7 rounded-md border border-line-strong px-2.5 text-[12px] font-semibold text-ink transition-colors enabled:hover:border-kill enabled:hover:text-kill disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {t('freeRam.close')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
