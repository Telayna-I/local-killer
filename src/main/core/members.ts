import type { RawProcess } from '../platform/types'
import { isShell, isTransientShell } from './classify'
import type { ProtectionPolicy } from './protect'
import { identityKey, type ProcessTree } from './tree'

/**
 * Processes that belong to an instance: its root and descendants, stopping at the root of another
 * instance, at interactive shells (a user terminal opened from an app or IDE) and at protected
 * processes. Without these boundaries a listening ancestor (an IDE, a service) would swallow every
 * dev server below it, hiding them and dragging them into its kill.
 */
export function instanceMembers(
  root: RawProcess,
  tree: ProcessTree,
  otherRoots: Set<string>,
  policy: ProtectionPolicy
): RawProcess[] {
  return tree.subtreeLeavesFirst(
    root,
    (p) =>
      otherRoots.has(identityKey(p)) ||
      (isShell(p) && !isTransientShell(p)) ||
      policy.isProtected(p)
  )
}
