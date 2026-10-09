// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectsView } from '@renderer/features/projects/ProjectsView'
import {
  createApiMock,
  installDialogPolyfill,
  makeInstance,
  makeSnapshot,
  renderWithProviders
} from './helpers'

const instances = [
  makeInstance({ id: 'a', label: 'vite', ports: [5173], isOrphan: true, origin: 'claude-code' }),
  makeInstance({ id: 'b', label: 'artisan serve', ports: [8000], pids: [200, 201] }),
  makeInstance({ id: 'c', label: 'next dev', repoRoot: 'C:\\code\\blog', repoName: 'blog' }),
  makeInstance({ id: 'd', label: 'spotify', kind: 'other', repoRoot: null, repoName: null }),
  makeInstance({ id: 'e', label: 'postgres', kind: 'protected', repoRoot: null, repoName: null })
]

const rowOf = (label: string): HTMLElement => {
  const row = screen.getByText(label).closest<HTMLElement>('[data-testid="instance-row"]')
  if (row === null) throw new Error(`no row for ${label}`)
  return row
}

beforeAll(installDialogPolyfill)
beforeEach(() => {
  window.api = createApiMock()
})
afterEach(cleanup)

describe('ProjectsView', () => {
  it('groups by repo, flags orphans and hides protected instances by default', () => {
    renderWithProviders(<ProjectsView snapshot={makeSnapshot(instances)} refresh={vi.fn()} />)

    const groups = screen.getAllByRole('region')
    expect(
      groups.map((group) => within(group).getByRole('heading', { level: 2 }).textContent)
    ).toEqual(['shop', 'blog', 'No repo'])
    expect(within(groups[0]).getAllByRole('listitem')).toHaveLength(2)
    expect(within(rowOf('vite')).queryByText('Orphan')).not.toBeNull()
    expect(within(rowOf('artisan serve')).queryByText('Orphan')).toBeNull()
    expect(screen.queryByText('postgres')).toBeNull()

    const protectedChip = screen.getByRole('button', { name: /^Protected/ })
    expect(protectedChip.getAttribute('aria-pressed')).toBe('false')
    expect(protectedChip.textContent).toBe('Protected1')
    fireEvent.click(protectedChip)

    expect(rowOf('postgres').dataset.kind).toBe('protected')
    expect(screen.queryByRole('button', { name: 'Kill postgres' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kill spotify' })).not.toBeNull()
  })

  it('filters by port and shows the all-clean state when nothing runs', () => {
    const { unmount } = renderWithProviders(
      <ProjectsView snapshot={makeSnapshot(instances)} refresh={vi.fn()} />
    )
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: ':8000' }
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(rowOf('artisan serve')).toBeTruthy()
    unmount()

    renderWithProviders(<ProjectsView snapshot={makeSnapshot([])} refresh={vi.fn()} />)
    expect(screen.getByTestId('projects-empty').textContent).toContain('All clean')
  })

  it('kills only after confirming, with the instance id, then refreshes', async () => {
    const refresh = vi.fn(() => Promise.resolve())
    vi.mocked(window.api.killInstances).mockResolvedValue({ killed: [200, 201], failed: [] })
    renderWithProviders(<ProjectsView snapshot={makeSnapshot(instances)} refresh={refresh} />)

    fireEvent.click(screen.getByRole('button', { name: 'Kill artisan serve' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      'Kill artisan serve?'
    )
    expect(within(dialog).queryByText(':8000')).not.toBeNull()
    expect(within(dialog).queryByText('2 processes')).not.toBeNull()
    expect(window.api.killInstances).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Kill' }))

    await waitFor(() => expect(window.api.killInstances).toHaveBeenCalledWith(['b']))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await screen.findByText('Killed 2 processes')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    const refresh = vi.fn(() => Promise.resolve())
    renderWithProviders(<ProjectsView snapshot={makeSnapshot(instances)} refresh={refresh} />)

    fireEvent.click(screen.getByRole('button', { name: 'Kill vite' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.api.killInstances).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('"Kill all" sends every killable instance of the repo and reports failures', async () => {
    vi.mocked(window.api.killInstances).mockResolvedValue({
      killed: [100],
      failed: [{ pid: 200, reason: 'access-denied' }]
    })
    renderWithProviders(<ProjectsView snapshot={makeSnapshot(instances)} refresh={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Kill everything in shop' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Kill 2 instances?')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kill' }))

    await waitFor(() => expect(window.api.killInstances).toHaveBeenCalledWith(['a', 'b']))
    await screen.findByText('1 with problems: access denied')
  })
})
