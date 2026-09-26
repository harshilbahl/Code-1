import type { CollectionName, Collections } from '../domain/types.js';

/**
 * Storage abstraction. Business logic never touches IndexedDB/localStorage directly —
 * it goes through a StorageAdapter. A future cloud adapter (e.g. REST or Supabase) can
 * implement the same interface, or wrap a local adapter and sync in the background.
 */
export interface StorageAdapter {
  readonly kind: string;
  open(): Promise<void>;
  getAll<K extends CollectionName>(name: K): Promise<Collections[K][]>;
  put<K extends CollectionName>(name: K, record: Collections[K]): Promise<void>;
  putMany<K extends CollectionName>(name: K, records: Collections[K][]): Promise<void>;
  delete(name: CollectionName, id: string): Promise<void>;
  clear(name: CollectionName): Promise<void>;
  /** Replace every collection atomically where supported (used by import/reset). */
  replaceAll(data: Partial<{ [K in CollectionName]: Collections[K][] }>): Promise<void>;
}
