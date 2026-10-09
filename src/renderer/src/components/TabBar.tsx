import { useRef, type KeyboardEvent } from 'react'
import { useT } from '../i18n/translator'
import { TABS, panelId, tabId, type TabId } from './tabs'

export interface TabCount {
  value: number
  /** Orphans are the signal worth noticing from another tab. */
  tone: 'muted' | 'orphan'
}

/** WAI-ARIA tabs: roving tabindex, arrows/Home/End move and activate. */
export function TabBar({
  active,
  onChange,
  counts
}: {
  active: TabId
  onChange: (tab: TabId) => void
  counts: Partial<Record<TabId, TabCount>>
}): React.JSX.Element {
  const { t } = useT()
  const buttons = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  const onKeyDown = (event: KeyboardEvent): void => {
    const index = TABS.indexOf(active)
    const target = {
      ArrowRight: TABS[(index + 1) % TABS.length],
      ArrowLeft: TABS[(index - 1 + TABS.length) % TABS.length],
      Home: TABS[0],
      End: TABS[TABS.length - 1]
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    onChange(target)
    buttons.current[target]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={t('tabs.label')}
      onKeyDown={onKeyDown}
      className="flex gap-1 border-b border-line bg-panel px-3"
    >
      {TABS.map((tab) => {
        const selected = tab === active
        const count = counts[tab]
        return (
          <button
            key={tab}
            ref={(element) => {
              buttons.current[tab] = element
            }}
            type="button"
            role="tab"
            id={tabId(tab)}
            aria-selected={selected}
            aria-controls={panelId(tab)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab)}
            data-testid={`tab-${tab}`}
            className={`relative flex h-10 items-center gap-2 px-3 font-display text-[12.5px] font-semibold tracking-[0.08em] uppercase transition-colors ${
              selected ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'
            }`}
          >
            {t(`tabs.${tab}`)}
            {count && count.value > 0 && (
              <span
                className={`tabular rounded px-1.5 font-mono text-[11px] tracking-normal ${
                  count.tone === 'orphan' ? 'bg-orphan/15 text-orphan' : 'bg-raised text-ink-muted'
                }`}
              >
                {count.value}
              </span>
            )}
            <span
              aria-hidden="true"
              className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors ${
                selected ? 'bg-kill' : 'bg-transparent'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
