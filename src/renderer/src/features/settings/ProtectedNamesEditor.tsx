import { useId, useState } from 'react'
import { CloseIcon } from '../../components/icons'
import { useT } from '../../i18n/translator'

const MAX_NAME_LENGTH = 100

/** Same normalization main applies when matching: lowercase, no `.exe`. */
const normalize = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\.exe$/, '')
    .slice(0, MAX_NAME_LENGTH)

export function ProtectedNamesEditor({
  names,
  onChange
}: {
  names: string[]
  onChange: (names: string[]) => void
}): React.JSX.Element {
  const { t } = useT()
  const inputId = useId()
  const [draft, setDraft] = useState('')

  const add = (): void => {
    const name = normalize(draft)
    if (name !== '' && !names.includes(name)) onChange([...names, name])
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-1.5" data-testid="protected-names">
        {names.map((name) => (
          <li
            key={name}
            className="flex h-6 items-center gap-1 rounded border border-line-strong bg-raised pr-0.5 pl-2 font-mono text-[12px] text-ink-muted"
          >
            {name}
            <button
              type="button"
              onClick={() => onChange(names.filter((other) => other !== name))}
              aria-label={t('settings.remove', { name })}
              className="grid size-5 place-items-center rounded text-ink-faint hover:bg-kill/15 hover:text-kill"
            >
              <CloseIcon width={10} height={10} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('settings.addName')}
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
          placeholder={t('settings.addName')}
          spellCheck={false}
          maxLength={MAX_NAME_LENGTH + 4}
          className="h-8 w-60 rounded-md border border-line-strong bg-canvas px-2.5 font-mono text-[12.5px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-port"
        />
        <button
          type="button"
          onClick={add}
          disabled={normalize(draft) === ''}
          className="h-8 rounded-md border border-line-strong px-3 font-medium text-ink hover:bg-raised disabled:opacity-40"
        >
          {t('settings.add')}
        </button>
      </div>
    </div>
  )
}
