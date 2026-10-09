import { useState } from 'react'
import type { Settings } from '../../shared/types'
import { Header } from './components/Header'
import { TabBar } from './components/TabBar'
import { panelId, tabId, type TabId } from './components/tabs'
import { DockerView } from './features/docker/DockerView'
import { FreeRamView } from './features/free-ram/FreeRamView'
import { ProjectsView } from './features/projects/ProjectsView'
import { SettingsView } from './features/settings/SettingsView'
import { ConfirmProvider } from './feedback/ConfirmProvider'
import { ToastProvider } from './feedback/ToastProvider'
import { DEFAULT_POLL_MS, useSettings } from './hooks/useSettings'
import { useSnapshot } from './hooks/useSnapshot'
import { I18nProvider } from './i18n/I18nProvider'
import { orphanDevInstances } from './lib/instances'

function Shell({
  settings,
  save
}: {
  settings: Settings | null
  save: (next: Settings) => Promise<Settings>
}): React.JSX.Element {
  const intervalMs = settings?.pollIntervalMs ?? DEFAULT_POLL_MS
  const { snapshot, error, refresh } = useSnapshot(intervalMs)
  const [tab, setTab] = useState<TabId>('projects')
  const instances = snapshot?.instances ?? []

  return (
    <div className="flex h-full flex-col">
      <Header snapshot={snapshot} error={error} onRefresh={() => void refresh()} />
      <TabBar
        active={tab}
        onChange={setTab}
        counts={{
          projects: {
            value: instances.filter((i) => i.kind !== 'protected').length,
            tone: 'muted'
          },
          freeRam: { value: orphanDevInstances(instances).length, tone: 'orphan' }
        }}
      />
      <main
        role="tabpanel"
        id={panelId(tab)}
        aria-labelledby={tabId(tab)}
        className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-10"
      >
        {tab === 'projects' && <ProjectsView snapshot={snapshot} refresh={refresh} />}
        {tab === 'freeRam' && <FreeRamView snapshot={snapshot} refresh={refresh} />}
        {tab === 'docker' && <DockerView intervalMs={Math.max(intervalMs, 5000)} />}
        {tab === 'settings' && <SettingsView settings={settings} save={save} />}
      </main>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const { settings, save, language } = useSettings()
  return (
    <I18nProvider language={language}>
      <ToastProvider>
        <ConfirmProvider>
          <Shell settings={settings} save={save} />
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
