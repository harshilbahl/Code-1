import { COLLECTIONS, type CollectionName, type Collections } from '../domain/types.js';
import type { StorageAdapter } from './types.js';

type Tables = { [K in CollectionName]: Map<string, Collections[K]> };

/**
 * In-memory adapter, optionally mirrored to a key-value store (localStorage).
 * Used for tests and as a fallback when IndexedDB is unavailable.
 */
export class MemoryAdapter implements StorageAdapter {
  readonly kind: string;
  private tables = {} as Tables;

  constructor(private kv?: { getItem(k: string): string | null; setItem(k: string, v: string): void }, private prefix = 'regain:') {
    this.kind = kv ? 'localStorage' : 'memory';
    for (const c of COLLECTIONS) (this.tables as Record<string, Map<string, unknown>>)[c] = new Map();
  }

  async open(): Promise<void> {
    if (!this.kv) return;
    for (const c of COLLECTIONS) {
      const raw = this.kv.getItem(this.prefix + c);
      if (!raw) continue;
      try {
        const rows = JSON.parse(raw) as { id: string }[];
        const t = this.table(c);
        rows.forEach((r) => t.set(r.id, r));
      } catch {
        /* ignore corrupt entry */
      }
    }
  }

  private table(name: CollectionName): Map<string, { id: string }> {
    return this.tables[name] as unknown as Map<string, { id: string }>;
  }

  private persist(name: CollectionName) {
    if (this.kv) this.kv.setItem(this.prefix + name, JSON.stringify([...this.table(name).values()]));
  }

  async getAll<K extends CollectionName>(name: K): Promise<Collections[K][]> {
    return [...this.table(name).values()].map((r) => structuredCloneSafe(r)) as Collections[K][];
  }

  async put<K extends CollectionName>(name: K, record: Collections[K]): Promise<void> {
    this.table(name).set(record.id, structuredCloneSafe(record));
    this.persist(name);
  }

  async putMany<K extends CollectionName>(name: K, records: Collections[K][]): Promise<void> {
    const t = this.table(name);
    records.forEach((r) => t.set(r.id, structuredCloneSafe(r)));
    this.persist(name);
  }

  async delete(name: CollectionName, id: string): Promise<void> {
    this.table(name).delete(id);
    this.persist(name);
  }

  async clear(name: CollectionName): Promise<void> {
    this.table(name).clear();
    this.persist(name);
  }

  async replaceAll(data: Partial<{ [K in CollectionName]: Collections[K][] }>): Promise<void> {
    for (const c of COLLECTIONS) {
      const t = this.table(c);
      t.clear();
      (data[c] as { id: string }[] | undefined)?.forEach((r) => t.set(r.id, structuredCloneSafe(r)));
      this.persist(c);
    }
  }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
