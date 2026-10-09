import { useId, useState, type FormEvent } from 'react'
import type { Language, Settings } from '../../../../shared/types'
import { useToast } from '../../feedback/context'
import { useT } from '../../i18n/translator'
import { AboutSection } from './AboutSection'
import { ProtectedNamesEditor } from './ProtectedNamesEditor'

const card = 'flex flex-col gap-4 rounded-xl border border-line bg-panel px-5 py-4'
const fieldLabel =
  'font-display text-[11px] font-semibold tracking-[0.12em] text-ink-faint uppercase'
const control =
  'h-8 rounded-md border border-line-strong bg-canvas px-2.5 text-[12.5px] text-ink focus:border-port'

function SettingsForm({
  initial,
  save
}: {
  initial: Settings
  save: (next: Settings) => Promise<Settings>
}): React.JSX.Element {
  const { t } = useT()
  const notify = useToast()
  const ids = { language: useId(), poll: useId(), pollHint: useId() }
  const [language, setLanguage] = useState<Language | null>(initial.language)
  const [seconds, setSeconds] = useState(String(Math.round(initial.pollIntervalMs / 1000)))
  const [names, setNames] = useState(initial.protectedNames)
  const [saving, setSaving] = useState(false)

  const secondsValue = Number(seconds)
  const secondsValid = Number.isInteger(secondsValue) && secondsValue >= 1 && secondsValue <= 60
  const dirty =
    language !== initial.language ||
    secondsValue * 1000 !== initial.pollIntervalMs ||
    names.join('\n') !== initial.protectedNames.join('\n')

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!secondsValid || saving) return
    setSaving(true)
    try {
      await save({ language, pollIntervalMs: secondsValue * 1000, protectedNames: names })
      notify({ tone: 'success', title: t('settings.saved') })
    } catch {
      notify({ tone: 'error', title: t('settings.saveError') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <section aria-labelledby="general-title" className={card}>
        <h2 id="general-title" className="font-display text-[15px] font-semibold tracking-[0.01em]">
          {t('settings.general')}
        </h2>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.language} className={fieldLabel}>
              {t('settings.language')}
            </label>
            <select
              id={ids.language}
              value={language ?? ''}
              onChange={(event) =>
                setLanguage(event.target.value === '' ? null : (event.target.value as Language))
              }
              className={`${control} w-44`}
            >
              <option value="">{t('settings.languageAuto')}</option>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.poll} className={fieldLabel}>
              {t('settings.pollInterval')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id={ids.poll}
                type="number"
                min={1}
                max={60}
                step={1}
                value={seconds}
                onChange={(event) => setSeconds(event.target.value)}
                aria-invalid={!secondsValid}
                aria-describedby={ids.pollHint}
                className={`${control} tabular w-20 font-mono aria-invalid:border-kill`}
              />
              <span className="text-ink-muted">{t('settings.seconds')}</span>
            </div>
            <p
              id={ids.pollHint}
              className={`text-[11.5px] ${secondsValid ? 'text-ink-faint' : 'text-kill'}`}
            >
              {t('settings.pollHint')}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="protected-title" className={card}>
        <div className="flex flex-col gap-1">
          <h2
            id="protected-title"
            className="font-display text-[15px] font-semibold tracking-[0.01em]"
          >
            {t('settings.protectedTitle')}
          </h2>
          <p className="max-w-2xl text-ink-muted">{t('settings.protectedBody')}</p>
        </div>
        <ProtectedNamesEditor names={names} onChange={setNames} />
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!dirty || !secondsValid || saving}
          className="h-9 rounded-md bg-port px-4 font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {t('settings.save')}
        </button>
      </div>
    </form>
  )
}

export function SettingsView({
  settings,
  save
}: {
  settings: Settings | null
  save: (next: Settings) => Promise<Settings>
}): React.JSX.Element {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-4">
      {settings ? (
        // Remount on every saved version so the draft always starts from what main stored.
        <SettingsForm key={JSON.stringify(settings)} initial={settings} save={save} />
      ) : (
        <p role="status" className="text-ink-muted">
          {t('common.loading')}
        </p>
      )}
      <AboutSection cardClass={card} />
    </div>
  )
}
