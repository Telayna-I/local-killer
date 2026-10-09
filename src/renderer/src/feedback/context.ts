import { createContext, useContext, type ReactNode } from 'react'
import type { ToastMessage } from '../lib/results'

export interface ConfirmOptions {
  title: string
  body?: string
  /** What is about to be affected, rendered between the body and the buttons. */
  details?: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'neutral'
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>
export type Notify = (message: ToastMessage) => void

export const ConfirmContext = createContext<Confirm>(() => Promise.resolve(false))
export const ToastContext = createContext<Notify>(() => undefined)

export const useConfirm = (): Confirm => useContext(ConfirmContext)
export const useToast = (): Notify => useContext(ToastContext)
