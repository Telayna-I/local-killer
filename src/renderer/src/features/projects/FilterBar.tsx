import { useId } from 'react'
import type { InstanceKind } from '../../../../shared/types'
import { SearchIcon } from '../../components/icons'
import { useT } from '../../i18n/translator'
import type { KindFilter } from '../../lib/instances'

const CHIPS: { kind: InstanceKind; dot: string }[] = [
  { kind: 'dev', dot: 'bg-port' },
  { kind: 'other', dot: 'bg-ink-muted' },
  { kind: 'protected', dot: 'bg-ink-faint' }
]

export function FilterBar({
  kinds,
  counts,
  query,
  onToggle,
  onQuery
}: {
  kinds: KindFilter
  counts: Record<InstanceKind, number>
  query: string
  onToggle: (kind: InstanceKind) => void
  onQuery: (query: string) => void
}): React.JSX.Element {
  const { t } = useT()
  const searchId = useId()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label={t('filters.label')} className="flex items-center gap-1.5">
        {CHIPS.map(({ kind, dot }) => {
          const on = kinds[kind]
          const hidden = !on && counts[kind] > 0
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(kind)}
              title={hidden ? t('filters.hiddenCount', { count: counts[kind] }) : undefined}
              data-testid={`filter-${kind}`}
              className={`flex h-7 items-center gap-2 rounded-full border px-3 text-[12px] font-medium transition-colors ${
                on
                  ? 'border-line-strong bg-raised text-ink'
                  : 'border-dashed border-line-strong text-ink-faint hover:text-ink-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${on ? dot : 'bg-line-strong'}`}
              />
              {t(`filters.${kind}`)}
              <span className="tabular font-mono text-[11px] text-ink-faint">{counts[kind]}</span>
            </button>
          )
        })}
      </div>

      <div className="relative ml-auto w-full max-w-72 min-w-48 flex-1">
        <label htmlFor={searchId} className="sr-only">
          {t('filters.search')}
        </label>
        <SearchIcon
          width={14}
          height={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t('filters.searchPlaceholder')}
          spellCheck={false}
          className="h-8 w-full rounded-md border border-line-strong bg-panel pr-2.5 pl-8 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-port"
        />
      </div>
    </div>
  )
}
