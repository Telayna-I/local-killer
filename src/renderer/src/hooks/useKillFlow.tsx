import { useCallback } from 'react'
import type { InstanceView } from '../../../shared/types'
import { InstanceSummaryList } from '../components/InstanceSummaryList'
import { useConfirm, useToast } from '../feedback/context'
import { useT } from '../i18n/translator'
import { errorMessage } from '../lib/format'
import { isKillable } from '../lib/instances'
import { summarizeKill } from '../lib/results'

/**
 * confirm (listing what dies) → killInstances → toast with the result → immediate refresh.
 * Protected instances are dropped before asking; main re-checks everything anyway.
 */
export function useKillFlow(
  refresh: () => Promise<void>
): (instances: InstanceView[]) => Promise<void> {
  const confirm = useConfirm()
  const notify = useToast()
  const translator = useT()

  return useCallback(
    async (instances: InstanceView[]) => {
      const { t } = translator
      const targets = instances.filter(isKillable)
      if (targets.length === 0) return
      const confirmed = await confirm({
        title:
          targets.length === 1
            ? t('kill.title.one', { name: targets[0].label })
            : t('kill.title.other', { count: targets.length }),
        body: t('kill.body'),
        details: <InstanceSummaryList instances={targets} />,
        confirmLabel: t('kill.confirm')
      })
      if (!confirmed) return
      try {
        const result = await window.api.killInstances(targets.map((instance) => instance.id))
        notify(summarizeKill(result, 'killed', translator))
      } catch (error) {
        notify({ tone: 'error', title: t('result.error', { message: errorMessage(error) }) })
      }
      await refresh()
    },
    [confirm, notify, translator, refresh]
  )
}
