import type { ContainerView } from '../../shared/types'

/** Parses `docker ps --format` output built from PS_FORMAT (tab separated, one container per line). */
export function parseDockerPs(output: string): ContainerView[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [id, name, image, ports, status, project, workingDir] = line.split('\t')
      return {
        id,
        name,
        image,
        ports: ports ?? '',
        status: status ?? '',
        composeProject: project || null,
        workingDir: workingDir || null
      }
    })
}
