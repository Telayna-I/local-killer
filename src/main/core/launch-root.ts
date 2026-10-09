import type { RawProcess } from '../platform/types'
import { isDevRuntime, isInitLike, isTransientShell } from './classify'
import type { ProcessTree } from './tree'

/**
 * Climbs from a seed (listener or orphan) through dev runtimes and one-shot shells, so
 * `cmd /c npm run dev → node npm → node vite` becomes one instance rooted at the `cmd /c`.
 * Stops below interactive shells, terminals, IDEs and Claude itself: those are never killed.
 */
export function findLaunchRoot(
  seed: RawProcess,
  tree: ProcessTree,
  isBlocked: (p: RawProcess) => boolean
): RawProcess {
  let root = seed
  for (const ancestor of tree.ancestorsOf(seed)) {
    if (isBlocked(ancestor) || isInitLike(ancestor)) break
    if (!isDevRuntime(ancestor) && !isTransientShell(ancestor)) break
    root = ancestor
  }
  return root
}

/** No living parent (or adopted by init/launchd/systemd): whoever launched it is gone. */
export function hasLostParent(root: RawProcess, tree: ProcessTree): boolean {
  const parent = tree.parentOf(root)
  return parent === null || isInitLike(parent)
}
