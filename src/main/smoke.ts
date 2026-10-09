import { app } from 'electron'
import type { SnapshotService } from './core/snapshot'

/**
 * `LocalKiller --smoke`: proves a packaged build can load the native layer (koffi from outside the
 * asar on Windows/macOS, procfs on Linux) and take a snapshot. Prints JSON and exits 0/1.
 */
export async function runSmokeTest(snapshots: SnapshotService): Promise<void> {
  try {
    const snapshot = await snapshots.take()
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        platform: snapshot.platform,
        instances: snapshot.instances.length,
        topConsumers: snapshot.topConsumers.length
      })}\n`
    )
    app.exit(0)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: String(error) })}\n`)
    app.exit(1)
  }
}
