import type { ReactNode } from 'react'
import { MarkIcon } from './icons'

export function EmptyState({
  title,
  body,
  tone = 'calm',
  action,
  testId
}: {
  title: string
  body: string
  tone?: 'calm' | 'muted'
  action?: ReactNode
  testId?: string
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      className="flex animate-rise flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center"
    >
      <span
        aria-hidden="true"
        className={`grid size-11 place-items-center rounded-full border ${
          tone === 'calm' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line-strong text-ink-faint'
        }`}
      >
        <MarkIcon width={20} height={20} />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[17px] font-semibold tracking-wide">{title}</h2>
        <p className="max-w-sm text-ink-muted">{body}</p>
      </div>
      {action}
    </div>
  )
}
