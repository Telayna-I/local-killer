import { useId } from 'react'
import type { InstanceView } from '../../../../shared/types'
import { FolderIcon } from '../../components/icons'
import { useT } from '../../i18n/translator'
import { formatBytes } from '../../lib/format'
import { isKillable, type RepoGroup } from '../../lib/instances'
import { InstanceRow } from './InstanceRow'
import { ROW_GRID } from './layout'

export function RepoGroupCard({
  group,
  takenAt,
  onKill
}: {
  group: RepoGroup
  takenAt: number
  onKill: (instances: InstanceView[]) => void
}): React.JSX.Element {
  const { t } = useT()
  const headingId = useId()
  const killable = group.instances.filter(isKillable)
  const name = group.root === null ? t('projects.noRepo') : (group.name ?? group.root)
  const orphans = group.instances.some((instance) => instance.isOrphan)

  return (
    <section
      aria-labelledby={headingId}
      data-testid="repo-group"
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_0_rgb(255_255_255/0.02)_inset]"
    >
      {/* Same grid as the rows: the group total sits right above the RAM column. */}
      <header className={`${ROW_GRID} border-b border-line px-3 py-2.5`}>
        <span className="grid place-items-center">
          <FolderIcon
            width={15}
            height={15}
            className={orphans ? 'text-orphan' : 'text-ink-faint'}
          />
        </span>
        <div className="col-span-2 min-w-0">
          <h2
            id={headingId}
            className="truncate font-display text-[15px] font-semibold tracking-[0.01em]"
          >
            {name}
          </h2>
          <p
            className="truncate font-mono text-[11.5px] text-ink-faint"
            title={group.root ?? undefined}
          >
            {group.root ?? t('projects.noRepoHint')}
          </p>
        </div>
        <span className="tabular text-right font-mono text-[12.5px] text-ink">
          {formatBytes(group.memoryBytes)}
        </span>
        <div className="col-span-4 flex justify-end">
          {killable.length > 1 && (
            <button
              type="button"
              data-testid="kill-group"
              onClick={() => onKill(killable)}
              aria-label={t('projects.killAllLabel', { name })}
              className="h-7 rounded-md px-2.5 text-[12px] font-semibold text-kill transition-colors hover:bg-kill/12"
            >
              {t('projects.killAll')}
            </button>
          )}
        </div>
      </header>
      <ul className="divide-y divide-line">
        {group.instances.map((instance, index) => (
          <InstanceRow
            key={instance.id}
            instance={instance}
            takenAt={takenAt}
            index={index}
            onKill={onKill}
          />
        ))}
      </ul>
    </section>
  )
}
