import { useEffect, useState } from 'react'
import type { UpdateState } from '../../../shared/types'

/** Current updater state: initial read plus live pushes from main, unsubscribed on unmount. */
export function useUpdateState(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    let active = true
    let pushed = false
    const unsubscribe = window.api.updates.onState((next) => {
      pushed = true
      if (active) setState(next)
    })
    window.api.updates.getState().then(
      // A push that arrived meanwhile is newer than this read.
      (initial) => active && !pushed && setState(initial),
      () => undefined
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return state
}
