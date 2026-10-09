import { describe, expect, it } from 'vitest'
import { ProcessTree } from '../../../src/main/core/tree'
import { proc } from '../fixtures'

describe('ProcessTree', () => {
  it('links children to parents that started earlier', () => {
    const shell = proc({ pid: 10, name: 'cmd.exe', startTimeMs: 100 })
    const node = proc({ pid: 20, ppid: 10, name: 'node.exe', startTimeMs: 200 })
    const tree = new ProcessTree([shell, node])

    expect(tree.parentOf(node)).toBe(shell)
    expect(tree.childrenOf(shell)).toEqual([node])
  })

  it('rejects a recycled parent PID that started after the child', () => {
    const reused = proc({ pid: 10, name: 'notepad.exe', startTimeMs: 500 })
    const orphan = proc({ pid: 20, ppid: 10, name: 'node.exe', startTimeMs: 200 })
    const tree = new ProcessTree([reused, orphan])

    expect(tree.parentOf(orphan)).toBeNull()
    expect(tree.childrenOf(reused)).toEqual([])
  })

  it('returns living ancestors closest first and stops on cycles', () => {
    const a = proc({ pid: 1, ppid: 3, name: 'a', startTimeMs: 0 })
    const b = proc({ pid: 2, ppid: 1, name: 'b', startTimeMs: 0 })
    const c = proc({ pid: 3, ppid: 2, name: 'c', startTimeMs: 0 })
    const tree = new ProcessTree([a, b, c])

    expect(tree.ancestorsOf(c).map((p) => p.pid)).toEqual([2, 1])
  })

  it('orders a subtree leaves first', () => {
    const root = proc({ pid: 1, name: 'cmd.exe' })
    const npm = proc({ pid: 2, ppid: 1, name: 'node.exe' })
    const vite = proc({ pid: 3, ppid: 2, name: 'node.exe' })
    const esbuild = proc({ pid: 4, ppid: 3, name: 'esbuild.exe' })
    const tree = new ProcessTree([root, npm, vite, esbuild])

    expect(tree.subtreeLeavesFirst(root).map((p) => p.pid)).toEqual([4, 3, 2, 1])
  })

  it('finds a process only when pid and start time match', () => {
    const node = proc({ pid: 7, name: 'node.exe', startTimeMs: 42 })
    const tree = new ProcessTree([node])

    expect(tree.find({ pid: 7, startTimeMs: 42 })).toBe(node)
    expect(tree.find({ pid: 7, startTimeMs: 43 })).toBeNull()
  })
})
