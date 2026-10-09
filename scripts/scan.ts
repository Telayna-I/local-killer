// Prints what LocalKiller would show for this machine. Usage: npm run scan [-- --raw] [-- --all]
import { getProvider } from '../src/main/platform'
import { SnapshotService } from '../src/main/core/snapshot'
import { DEFAULT_PROTECTED_NAMES } from '../src/main/core/protect'

const MB = 1024 * 1024

async function main(): Promise<void> {
  const provider = await getProvider()
  if (process.argv.includes('--raw')) {
    const [processes, listeners] = await Promise.all([
      provider.listProcesses(),
      provider.listListeners()
    ])
    console.log(JSON.stringify({ processes, listeners }, null, 2))
    return
  }
  const settings = { language: null, pollIntervalMs: 3000, protectedNames: DEFAULT_PROTECTED_NAMES }
  const service = new SnapshotService(provider, () => settings)
  await service.take()
  const started = performance.now()
  const snapshot = await service.take()
  const elapsed = Math.round(performance.now() - started)
  const showAll = process.argv.includes('--all')

  console.log(`snapshot in ${elapsed}ms — ${snapshot.instances.length} instances`)
  for (const instance of snapshot.instances) {
    if (instance.kind === 'protected' && !showAll) continue
    const flags = [
      instance.kind,
      instance.origin,
      instance.isOrphan ? 'ORPHAN' : '',
      instance.limited ? 'limited' : ''
    ]
    console.log(
      `\n[${instance.id}] ${instance.label}  ${flags.filter(Boolean).join(' · ')}\n` +
        `   repo: ${instance.repoName ?? '-'} (${instance.repoRoot ?? instance.cwd ?? '?'})\n` +
        `   ports: ${instance.ports.join(', ') || '-'}  pids: ${instance.pids.join(',')}\n` +
        `   mem: ${Math.round(instance.memoryBytes / MB)}MB  cpu: ${instance.cpuPercent.toFixed(1)}%`
    )
  }
  console.log('\nTop consumers:')
  for (const consumer of snapshot.topConsumers) {
    console.log(
      `   ${consumer.name.padEnd(28)} ${String(Math.round(consumer.memoryBytes / MB)).padStart(6)}MB ` +
        `${consumer.processCount} procs${consumer.isProtected ? ' (protected)' : ''}`
    )
  }
}

void main()
