import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CloseIcon } from '../components/icons'
import { useT } from '../i18n/translator'
import type { ToastMessage, ToastTone } from '../lib/results'
import { ToastContext, type Notify } from './context'

interface Toast extends ToastMessage {
  id: number
}

const MAX_VISIBLE = 4
const DURATION_MS: Record<ToastTone, number> = { success: 4500, warning: 8000, error: 10000 }
const TONE_BAR: Record<ToastTone, string> = {
  success: 'bg-ok',
  warning: 'bg-orphan',
  error: 'bg-kill'
}

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { t } = useT()
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback<Notify>(
    (message) => {
      nextId.current += 1
      const id = nextId.current
      setToasts((list) => [...list.slice(1 - MAX_VISIBLE), { ...message, id }])
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        dismiss(id)
      }, DURATION_MS[message.tone])
      timers.current.add(timer)
    },
    [dismiss]
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid="toast"
            className="pointer-events-auto flex animate-toast overflow-hidden rounded-lg border border-line-strong bg-raised shadow-xl shadow-black/30"
          >
            <span aria-hidden="true" className={`w-1 shrink-0 ${TONE_BAR[toast.tone]}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-2 pl-3">
              <p className="font-medium text-ink">{toast.title}</p>
              {toast.detail && <p className="text-[12px] text-ink-muted">{toast.detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t('common.dismiss')}
              className="m-1.5 grid size-6 shrink-0 place-items-center rounded text-ink-faint hover:bg-panel hover:text-ink"
            >
              <CloseIcon width={12} height={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
