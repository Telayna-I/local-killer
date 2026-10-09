import { useEffect, useState } from 'react'
import type { Snapshot } from '../../shared/types'

function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    void window.api.getSnapshot().then(setSnapshot)
  }, [])

  return (
    <main className="p-6 font-sans">
      <h1 className="text-xl font-semibold">LocalKiller</h1>
      <ul>
        {snapshot?.instances.map((instance) => (
          <li key={instance.id}>
            {instance.label} — {instance.ports.join(', ')}
          </li>
        ))}
      </ul>
    </main>
  )
}

export default App
