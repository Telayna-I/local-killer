import { useUpdateState } from '../hooks/useUpdateState'
import { useT } from '../i18n/translator'

const actionClass =
  'h-7 shrink-0 rounded-md bg-port px-3 text-[12px] font-semibold text-on-accent hover:brightness-110'

/** Thin strip under the header; only visible when there is something to act on or to know. */
export function UpdateBanner(): React.JSX.Element | null {
  const { t } = useT()
  const state = useUpdateState()

  if (state.status === 'error') {
    return (
      <p
        data-testid="update-banner"
        title={state.message}
        className="px-5 pb-2 text-[11.5px] text-ink-faint"
      >
        {t('update.errorShort')}
      </p>
    )
  }
  if (
    state.status !== 'available' &&
    state.status !== 'downloading' &&
    state.status !== 'downloaded'
  ) {
    return null
  }

  return (
    <div
      data-testid="update-banner"
      role="region"
      aria-label={t('settings.checkUpdates')}
      className="mx-5 mb-3 flex items-center gap-3 rounded-lg border border-port/30 bg-port/8 px-3 py-2"
    >
      <span aria-hidden="true" className="size-1.5 animate-signal rounded-full bg-port" />
      <p className="min-w-0 flex-1 text-[12.5px] text-ink">
        {state.status === 'available' && t('update.available', { version: state.version })}
        {state.status === 'downloading' &&
          t('update.downloading', { version: state.version, percent: state.percent })}
        {state.status === 'downloaded' && t('update.downloaded', { version: state.version })}
      </p>
      {state.status === 'downloading' && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.percent}
          className="h-1 w-28 overflow-hidden rounded-full bg-line-strong"
        >
          <div className="h-full bg-port" style={{ width: `${state.percent}%` }} />
        </div>
      )}
      {state.status === 'available' && state.manualDownloadUrl && (
        <button
          type="button"
          className={actionClass}
          onClick={() => void window.api.updates.openDownload()}
        >
          {t('update.download')}
        </button>
      )}
      {state.status === 'downloaded' && (
        <button
          type="button"
          className={actionClass}
          onClick={() => void window.api.updates.install()}
        >
          {t('update.restart')}
        </button>
      )}
    </div>
  )
}
