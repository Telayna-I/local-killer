import type { InstanceView } from '../../../shared/types'
import { useT } from '../i18n/translator'
import { formatBytes } from '../lib/format'
import { totalMemory, totalProcesses } from '../lib/instances'

/** What a kill confirmation is about to take down: label, ports, process count, RAM. */
export function InstanceSummaryList({
  instances
}: {
  instances: InstanceView[]
}): React.JSX.Element {
  const { t, tn } = useT()
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-sunken">
      <ul className="max-h-56 divide-y divide-line overflow-y-auto">
        {instances.map((instance) => (
          <li key={instance.id} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[12.5px] text-ink">{instance.label}</p>
              <p className="truncate text-[11.5px] text-ink-faint">
                {instance.repoName ?? instance.cwd ?? t('projects.noRepo')}
              </p>
            </div>
            {instance.ports.length > 0 ? (
              <span className="font-mono text-[12px] text-port">
                {instance.ports.map((port) => `:${port}`).join(' ')}
              </span>
            ) : (
              <span className="text-[12px] text-ink-faint">{t('instance.noPorts')}</span>
            )}
            <span className="w-20 text-right text-[12px] text-ink-muted">
              {tn('instance.processes', instance.pids.length)}
            </span>
            <span className="tabular w-16 text-right font-mono text-[12px] text-ink">
              {formatBytes(instance.memoryBytes)}
            </span>
          </li>
        ))}
      </ul>
      {instances.length > 1 && (
        <p className="border-t border-line px-3 py-2 text-right text-[12px] text-ink-muted">
          {t('kill.total', {
            processes: tn('instance.processes', totalProcesses(instances)),
            memory: formatBytes(totalMemory(instances))
          })}
        </p>
      )}
    </div>
  )
}
