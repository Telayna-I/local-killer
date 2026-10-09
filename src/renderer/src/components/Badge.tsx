import type { ReactNode } from 'react'
import type { Origin } from '../../../shared/types'
import { useT } from '../i18n/translator'

type Tone = 'orphan' | 'muted' | 'protected'

const TONES: Record<Tone, string> = {
  orphan: 'border-orphan/40 bg-orphan/12 text-orphan',
  muted: 'border-line-strong text-ink-muted',
  protected: 'border-line-strong bg-raised text-ink-muted'
}

export function Badge({
  tone,
  hint,
  children
}: {
  tone: Tone
  /** Native tooltip + accessible description. */
  hint?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <span
      title={hint}
      className={`inline-flex h-5 shrink-0 cursor-default items-center gap-1.5 rounded border px-1.5 font-display text-[10.5px] font-semibold tracking-[0.06em] uppercase ${TONES[tone]}`}
    >
      {children}
      {hint && <span className="sr-only">: {hint}</span>}
    </span>
  )
}

export function OrphanBadge(): React.JSX.Element {
  const { t } = useT()
  return (
    <Badge tone="orphan" hint={t('instance.orphanHint')}>
      <span aria-hidden="true" className="size-1.5 animate-signal rounded-full bg-orphan" />
      {t('instance.orphan')}
    </Badge>
  )
}

const ORIGIN_DOT: Record<Origin, string> = {
  'claude-code': 'bg-claude',
  vscode: 'bg-vscode',
  cursor: 'bg-cursor',
  jetbrains: 'bg-jetbrains',
  terminal: 'bg-terminal',
  unknown: 'bg-unknown'
}

/** Claude Code is filled so it stands out; every other origin is a quiet outlined chip. */
export function OriginBadge({ origin }: { origin: Origin }): React.JSX.Element {
  const { t } = useT()
  const name = t(`origin.${origin}`)
  const claude = origin === 'claude-code'
  return (
    <span
      title={t('instance.launchedFrom', { origin: name })}
      data-origin={origin}
      className={`inline-flex h-5 shrink-0 cursor-default items-center gap-1.5 rounded px-1.5 text-[11px] font-medium ${
        claude
          ? 'border border-claude/40 bg-claude/15 text-claude'
          : 'border border-line-strong text-ink-muted'
      }`}
    >
      {claude ? (
        <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5">
          <path
            d="M5 0v10M0 5h10M1.5 1.5l7 7M8.5 1.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <span aria-hidden="true" className={`size-1.5 rounded-full ${ORIGIN_DOT[origin]}`} />
      )}
      {name}
    </span>
  )
}
