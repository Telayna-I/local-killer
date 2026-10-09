import { useMemo, useState } from 'react'
import type { InstanceKind, Snapshot } from '../../../../shared/types'
import { EmptyState } from '../../components/EmptyState'
import { useKillFlow } from '../../hooks/useKillFlow'
import { useT } from '../../i18n/translator'
import {
  DEFAULT_KIND_FILTER,
  filterInstances,
  groupByRepo,
  type KindFilter
} from '../../lib/instances'
import { FilterBar } from './FilterBar'
import { ROW_GRID } from './layout'
import { RepoGroupCard } from './RepoGroupCard'

function ColumnHeader(): React.JSX.Element {
  const { t } = useT()
  const columns = [
    '',
    t('projects.columns'),
    t('instance.ports'),
    t('instance.ram'),
    t('instance.cpu'),
    t('instance.uptime'),
    t('instance.processCount'),
    ''
  ]
  return (
    <div
      aria-hidden="true"
      className={`${ROW_GRID} px-[13px] font-display text-[10.5px] font-semibold tracking-[0.12em] text-ink-faint uppercase`}
    >
      {columns.map((column, index) => (
        <span key={index} className={index >= 3 && index <= 6 ? 'text-right' : ''}>
          {column}
        </span>
      ))}
    </div>
  )
}

function LoadingRows(): React.JSX.Element {
  const { t } = useT()
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{t('projects.loading')}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-14 animate-pulse rounded-xl border border-line bg-panel" />
      ))}
    </div>
  )
}

export function ProjectsView({
  snapshot,
  refresh
}: {
  snapshot: Snapshot | null
  refresh: () => Promise<void>
}): React.JSX.Element {
  const { t } = useT()
  const [kinds, setKinds] = useState<KindFilter>(DEFAULT_KIND_FILTER)
  const [query, setQuery] = useState('')
  const kill = useKillFlow(refresh)

  const instances = useMemo(() => snapshot?.instances ?? [], [snapshot])
  const groups = useMemo(
    () => groupByRepo(filterInstances(instances, kinds, query)),
    [instances, kinds, query]
  )
  const counts = useMemo(() => {
    const result: Record<InstanceKind, number> = { dev: 0, other: 0, protected: 0 }
    for (const instance of instances) result[instance.kind] += 1
    return result
  }, [instances])

  if (snapshot === null) return <LoadingRows />

  const nothingRunning = counts.dev + counts.other === 0 && query.trim() === ''

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        kinds={kinds}
        counts={counts}
        query={query}
        onToggle={(kind) => setKinds((current) => ({ ...current, [kind]: !current[kind] }))}
        onQuery={setQuery}
      />
      {groups.length === 0 ? (
        nothingRunning ? (
          <EmptyState
            testId="projects-empty"
            title={t('projects.emptyTitle')}
            body={t('projects.emptyBody')}
          />
        ) : (
          <EmptyState
            tone="muted"
            title={t('projects.noMatchTitle')}
            body={t('projects.noMatchBody')}
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <ColumnHeader />
          {groups.map((group) => (
            <RepoGroupCard
              key={group.root ?? '∅'}
              group={group}
              takenAt={snapshot.takenAt}
              onKill={(targets) => void kill(targets)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
