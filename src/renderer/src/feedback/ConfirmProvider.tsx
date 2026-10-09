import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../i18n/translator'
import { ConfirmContext, type Confirm, type ConfirmOptions } from './context'

/** One native modal <dialog> for the whole app; `useConfirm()` resolves true only on the confirm button. */
export function ConfirmProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { t } = useT()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)

  const confirm = useCallback<Confirm>((next) => {
    resolverRef.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOptions(next)
    })
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (options === null || dialog === null || dialog.open) return
    // Escape keeps the previous returnValue: reset it so a cancel can never read as "confirm".
    dialog.returnValue = ''
    dialog.showModal()
    // Destructive dialogs start on Cancel, so a stray Enter never kills anything.
    cancelRef.current?.focus()
  }, [options])

  const settle = (): void => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setOptions(null)
    resolve?.(dialogRef.current?.returnValue === 'confirm')
  }
  const close = (value: 'cancel' | 'confirm'): void => dialogRef.current?.close(value)
  const danger = (options?.tone ?? 'danger') === 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        onClose={settle}
        aria-labelledby="confirm-title"
        aria-describedby={options?.body ? 'confirm-body' : undefined}
        data-testid="confirm-dialog"
        className="m-auto w-[min(500px,calc(100vw-32px))] rounded-xl border border-line-strong bg-panel p-0 text-ink shadow-2xl shadow-black/40 open:animate-rise"
      >
        {options && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-1 size-2.5 shrink-0 rounded-full ${danger ? 'bg-kill' : 'bg-port'}`}
              />
              <div className="flex min-w-0 flex-col gap-1.5">
                <h2 id="confirm-title" className="font-display text-[17px] font-semibold">
                  {options.title}
                </h2>
                {options.body && (
                  <p id="confirm-body" className="text-ink-muted">
                    {options.body}
                  </p>
                )}
              </div>
            </div>
            {options.details}
            <div className="flex justify-end gap-2 pt-1">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => close('cancel')}
                className="h-8 rounded-md border border-line-strong px-3.5 font-medium text-ink hover:bg-raised"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="confirm-accept"
                onClick={() => close('confirm')}
                className={`h-8 rounded-md px-3.5 font-semibold text-on-accent ${danger ? 'bg-kill hover:brightness-110' : 'bg-port hover:brightness-110'}`}
              >
                {options.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  )
}
