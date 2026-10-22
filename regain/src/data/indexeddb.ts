import { COLLECTIONS, type CollectionName, type Collections } from '../domain/types.js';
import type { StorageAdapter } from './types.js';

const DB_NAME = 'regain';
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export class IndexedDBAdapter implements StorageAdapter {
  readonly kind = 'indexedDB';
  private db: IDBDatabase | null = null;

  static available(): boolean {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      return false;
    }
  }

  async open(): Promise<void> {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const c of COLLECTIONS) {
        if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
      }
    };
    this.db = await req(open);
    // Another tab upgraded the schema: close so it can proceed; next load picks it up.
    this.db.onversionchange = () => this.db?.close();
  }

  private store(name: CollectionName | CollectionName[], mode: IDBTransactionMode) {
    if (!this.db) throw new Error('Database not open');
    return this.db.transaction(name, mode);
  }

  async getAll<K extends CollectionName>(name: K): Promise<Collections[K][]> {
    const tx = this.store(name, 'readonly');
    return (await req(tx.objectStore(name).getAll())) as Collections[K][];
  }

  async put<K extends CollectionName>(name: K, record: Collections[K]): Promise<void> {
    const tx = this.store(name, 'readwrite');
    tx.objectStore(name).put(record);
    await done(tx);
  }

  async putMany<K extends CollectionName>(name: K, records: Collections[K][]): Promise<void> {
    const tx = this.store(name, 'readwrite');
    const s = tx.objectStore(name);
    records.forEach((r) => s.put(r));
    await done(tx);
  }

  async delete(name: CollectionName, id: string): Promise<void> {
    const tx = this.store(name, 'readwrite');
    tx.objectStore(name).delete(id);
    await done(tx);
  }

  async clear(name: CollectionName): Promise<void> {
    const tx = this.store(name, 'readwrite');
    tx.objectStore(name).clear();
    await done(tx);
  }

  async replaceAll(data: Partial<{ [K in CollectionName]: Collections[K][] }>): Promise<void> {
    const tx = this.store(COLLECTIONS, 'readwrite');
    for (const c of COLLECTIONS) {
      const s = tx.objectStore(c);
      s.clear();
      (data[c] as unknown[] | undefined)?.forEach((r) => s.put(r));
    }
    await done(tx);
  }
}
