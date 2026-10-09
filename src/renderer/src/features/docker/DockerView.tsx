import type { ContainerView } from '../../../../shared/types'
import { EmptyState } from '../../components/EmptyState'
import { useConfirm, useToast } from '../../feedback/context'
import { useDocker } from '../../hooks/useDocker'
import { useT } from '../../i18n/translator'
import { errorMessage } from '../../lib/format'

/** "0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp" → ["5433→5432/tcp"]: host-side noise removed. */
function publishedPorts(ports: string): string[] {
  const entries = ports
    .split(',')
    .map((entry) =>
      entry
        .trim()
        .replace(/^(?:0\.0\.0\.0|\[::\]):/, '')
        .replace('->', '→')
    )
    .filter((entry) => entry !== '')
  return entries.length > 0 ? [...new Set(entries)] : ['—']
}

const headCell =
  'px-3 py-2 font-display text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase'

export function DockerView({ intervalMs }: { intervalMs: number }): React.JSX.Element {
  const { t } = useT()
  const confirm = useConfirm()
  const notify = useToast()
  const { data, error, refresh } = useDocker(intervalMs)

  const stop = async (container: ContainerView): Promise<void> => {
    const confirmed = await confirm({
      title: t('docker.stopTitle', { name: container.name }),
      body: t('docker.stopBody'),
      confirmLabel: t('docker.stop')
    })
    if (!confirmed) return
    try {
      const result = await window.api.stopContainers([container.id])
      notify(
        result.failed.length === 0
          ? { tone: 'success', title: t('docker.stopped') }
          : { tone: 'error', title: t('docker.stopFailed', { name: container.name }) }
      )
    } catch (caught) {
      notify({ tone: 'error', title: t('result.error', { message: errorMessage(caught) }) })
    }
    await refresh()
  }

  if (data === null) {
    return error ? (
      <EmptyState tone="muted" title={t('docker.unavailableTitle')} body={error} />
    ) : (
      <p role="status" className="text-ink-muted">
        {t('common.loading')}
      </p>
    )
  }
  if (!data.available) {
    return (
      <EmptyState
        testId="docker-unavailable"
        tone="muted"
        title={t('docker.unavailableTitle')}
        body={t('docker.unavailableBody')}
      />
    )
  }
  if (data.containers.length === 0) {
    return <EmptyState title={t('docker.emptyTitle')} body={t('docker.emptyBody')} />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <table className="w-full table-fixed border-collapse text-left">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={`${headCell} pl-5`}>
              {t('docker.name')}
            </th>
            <th scope="col" className={`${headCell} w-52`}>
              {t('docker.ports')}
            </th>
            <th scope="col" className={`${headCell} w-[30%]`}>
              {t('docker.project')}
            </th>
            <th scope="col" className={`${headCell} w-36`}>
              {t('docker.status')}
            </th>
            <th scope="col" className={`${headCell} w-24`}>
              <span className="sr-only">{t('docker.stop')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.containers.map((container) => (
            <tr
              key={container.id}
              data-testid="container-row"
              className="align-top hover:bg-raised/60"
            >
              <td className="px-3 py-2.5 pl-5">
                <p className="truncate font-medium text-ink">{container.name}</p>
                <p
                  className="truncate font-mono text-[11.5px] text-ink-faint"
                  title={container.image}
                >
                  {container.image}
                </p>
              </td>
              <td className="px-3 py-2.5 font-mono text-[12px] text-port" title={container.ports}>
                {publishedPorts(container.ports).map((port) => (
                  <p key={port} className="truncate">
                    {port}
                  </p>
                ))}
              </td>
              <td className="px-3 py-2.5">
                <p className="truncate text-ink-muted">{container.composeProject ?? '—'}</p>
                {container.workingDir && (
                  <p
                    className="truncate font-mono text-[11.5px] text-ink-faint"
                    title={container.workingDir}
                  >
                    {container.workingDir}
                  </p>
                )}
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${/^up\b/i.test(container.status) ? 'bg-ok' : 'bg-ink-faint'}`}
                  />
                  <span className="truncate">{container.status}</span>
                </span>
              </td>
              <td className="px-3 py-2 pr-4 text-right">
                <button
                  type="button"
                  onClick={() => void stop(container)}
                  aria-label={t('docker.stopLabel', { name: container.name })}
                  className="h-7 rounded-md border border-line-strong px-2.5 text-[12px] font-semibold text-ink transition-colors hover:border-kill hover:text-kill"
                >
                  {t('docker.stop')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
