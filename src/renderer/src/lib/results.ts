import type { KillFailure, KillResult } from '../../../shared/types'
import type { Translator } from '../i18n/translator'

export type ToastTone = 'success' | 'warning' | 'error'

export interface ToastMessage {
  tone: ToastTone
  title: string
  detail?: string
}

/** "acceso denegado ×2, sigue corriendo" — failures grouped by reason, in a stable order. */
function describeFailures(failed: KillFailure[], { t }: Translator): string {
  const counts = new Map<KillFailure['reason'], number>()
  for (const { reason } of failed) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts]
    .map(([reason, count]) => `${t(`reason.${reason}`)}${count > 1 ? ` ×${count}` : ''}`)
    .join(', ')
}

/** Toast for killInstances / closeApps: what died, and why anything didn't. */
export function summarizeKill(
  result: KillResult,
  verb: 'killed' | 'closed',
  translator: Translator
): ToastMessage {
  const { t, tn } = translator
  const done = result.killed.length
  const title = done > 0 ? tn(`result.${verb}`, done) : t('result.nothing')
  if (result.failed.length === 0) {
    return { tone: done > 0 ? 'success' : 'warning', title }
  }
  return {
    tone: done > 0 ? 'warning' : 'error',
    title,
    detail: t('result.failed', {
      count: result.failed.length,
      reasons: describeFailures(result.failed, translator)
    })
  }
}
