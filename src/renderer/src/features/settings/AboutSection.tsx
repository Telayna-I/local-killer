import { useEffect, useState } from 'react'
import type { UpdateState } from '../../../../shared/types'
import { useUpdateState } from '../../hooks/useUpdateState'
import { useT, type Translator } from '../../i18n/translator'

function describeUpdate(state: UpdateState, { t }: Translator): string {
  switch (state.status) {
    case 'available':
    case 'downloaded':
      return t(`update.${state.status}`, { version: state.version })
    case 'downloading':
      return t('update.downloading', { version: state.version, percent: state.percent })
    case 'error':
      return t('update.error', { message: state.message })
    default:
      return t(`update.${state.status}`)
  }
}

export function AboutSection({ cardClass }: { cardClass: string }): React.JSX.Element {
  const translator = useT()
  const { t } = translator
  const state = useUpdateState()
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    window.api.getAppVersion().then(
      (value) => active && setVersion(value),
      () => undefined
    )
    return () => {
      active = false
    }
  }, [])

  const busy = state.status === 'checking' || state.status === 'downloading'

  return (
    <section aria-labelledby="about-title" className={cardClass}>
      <h2 id="about-title" className="font-display text-[15px] font-semibold tracking-[0.01em]">
        {t('settings.about')}
      </h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-mono text-[12.5px] text-ink" data-testid="app-version">
          LocalKiller {version ? t('settings.version', { version }) : '…'}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void window.api.updates.check()}
          className="h-8 rounded-md border border-line-strong px-3 font-medium text-ink hover:bg-raised disabled:opacity-40"
        >
          {t('settings.checkUpdates')}
        </button>
      </div>
      <p role="status" className="text-[12.5px] text-ink-muted" data-testid="update-status">
        {describeUpdate(state, translator)}
      </p>
    </section>
  )
}
