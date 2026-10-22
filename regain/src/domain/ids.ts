/** Record ids. Lives in domain, not data: nothing here touches storage. */

/** A unique id for a new record. randomUUID where available, else timestamp + random. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
