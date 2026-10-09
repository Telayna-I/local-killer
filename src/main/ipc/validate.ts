const MAX_IDS = 500
const MAX_ID_LENGTH = 200

/** Renderer input boundary: ids must be a bounded list of short strings. */
export function assertIdList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_IDS) throw new Error('Invalid id list')
  for (const id of value) {
    if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) {
      throw new Error('Invalid id')
    }
  }
  return value as string[]
}
