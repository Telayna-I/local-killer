import { useId, useState, type ReactNode } from 'react'
import type { InstanceView } from '../../../../shared/types'
import { Badge, OrphanBadge, OriginBadge } from '../../components/Badge'
import { ChevronIcon, LockIcon } from '../../components/icons'
import { useT } from '../../i18n/translator'
import { formatBytes, formatPercent, formatUptime } from '../../lib/format'
import { ROW_GRID } from './layout'

function Metric({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <span className="tabular truncate text-right font-mono text-[12.5px] text-ink-muted">
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  )
}

function Detail({ term, children }: { term: string; children: ReactNode }): React.JSX.Element {
  return (
    <>
      <dt className="font-display text-[10.5px] font-semibold tracking-[0.1em] text-ink-faint uppercase">
        {term}
      </dt>
      <dd className="min-w-0 font-mono text-[12px] break-all text-ink-muted select-text">
        {children}
      </dd>
    </>
  )
}

export function InstanceRow({
  instance,
  takenAt,
  index,
  onKill
}: {
  instance: InstanceView
  /** Snapshot time: uptime is measured against it so render stays pure. */
  takenAt: number
  index: number
  onKill: (instances: InstanceView[]) => void
}): React.JSX.Element {
  const { t, tn } = useT()
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const killable = instance.kind !== 'protected'

  return (
    <li
      data-testid="instance-row"
      data-kind={instance.kind}
      data-orphan={instance.isOrphan}
      style={{ animationDelay: `${Math.min(index, 12) * 22}ms` }}
      className={`relative animate-rise ${instance.isOrphan ? 'bg-orphan/[0.035]' : ''}`}
    >
      {instance.isOrphan && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-orphan" />
      )}
      <div className={`${ROW_GRID} min-h-11 px-3 py-1.5 transition-colors hover:bg-raised/70`}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          data-testid="toggle-details"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={t('instance.toggleDetails', { name: instance.label })}
          className="grid size-6 place-items-center rounded text-ink-faint hover:bg-raised hover:text-ink"
        >
          <ChevronIcon
            width={13}
            height={13}
            className={`transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`truncate font-mono text-[13px] ${killable ? 'text-ink' : 'text-ink-muted'}`}
            title={instance.commandLine ?? instance.label}
          >
            {instance.label}
          </span>
          <OriginBadge origin={instance.origin} />
          {instance.isOrphan && <OrphanBadge />}
          {instance.limited && (
            <Badge tone="muted" hint={t('instance.limitedHint')}>
              {t('instance.limited')}
            </Badge>
          )}
          {!killable && (
            <Badge tone="protected" hint={t('instance.protectedHint')}>
              <LockIcon width={10} height={10} />
              {t('instance.protected')}
            </Badge>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap gap-1">
          <span className="sr-only">{t('instance.ports')}: </span>
          {instance.ports.length > 0 ? (
            instance.ports.map((port) => (
              <span
                key={port}
                data-testid="port-chip"
                data-port={port}
                className="rounded bg-port/10 px-1.5 font-mono text-[12px] leading-5 text-port"
              >
                :{port}
              </span>
            ))
          ) : (
            <span className="text-[12px] text-ink-faint">{t('instance.noPorts')}</span>
          )}
        </div>

        <Metric label={t('instance.ram')}>
          <span className="text-ink">{formatBytes(instance.memoryBytes)}</span>
        </Metric>
        <Metric label={t('instance.cpu')}>{formatPercent(instance.cpuPercent)}</Metric>
        <Metric label={t('instance.uptime')}>{formatUptime(takenAt - instance.startedAt)}</Metric>
        <Metric label={t('instance.processCount')}>
          <span title={tn('instance.processes', instance.pids.length)}>{instance.pids.length}</span>
        </Metric>

        <div className="flex justify-end">
          {killable && (
            <button
              type="button"
              data-testid="kill-instance"
              onClick={() => onKill([instance])}
              aria-label={t('instance.killLabel', { name: instance.label })}
              className="h-7 rounded-md border border-kill/45 px-2.5 text-[12px] font-semibold text-kill transition-colors hover:border-kill hover:bg-kill hover:text-on-accent"
            >
              {t('instance.kill')}
            </button>
          )}
        </div>
      </div>

      {open && (
        <dl
          id={detailsId}
          className="grid animate-rise grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-dashed border-line bg-sunken/60 py-3 pr-4 pl-12"
        >
          <Detail term={t('instance.command')}>
            {instance.commandLine ?? t('instance.unknownValue')}
          </Detail>
          <Detail term={t('instance.cwd')}>{instance.cwd ?? t('instance.unknownValue')}</Detail>
          <Detail term={t('instance.pids')}>
            <span data-testid="instance-pids">{instance.pids.join(', ')}</span>
          </Detail>
        </dl>
      )}
    </li>
  )
}
