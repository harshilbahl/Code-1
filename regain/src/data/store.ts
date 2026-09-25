import { dateKey } from '../domain/dates.js';
import { BACK_TEMPLATE, SEED_EXERCISES, SEED_FOODS, defaultMealPlan, defaultProfile, defaultSettings, workoutFromTemplate } from '../domain/seed.js';
import { COLLECTIONS, type CollectionName, type Collections, type Settings, type UserProfile } from '../domain/types.js';
import type { BackupData } from './backup.js';
import type { StorageAdapter } from './types.js';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

type Cache = { [K in CollectionName]: Map<string, Collections[K]> };
type Listener = () => void;

/**
 * Application data store: an in-memory cache of every collection, write-through to a
 * StorageAdapter. Reads are synchronous (fast UI); writes are queued in order and any
 * persistence failure is reported through `onError`.
 */
export class Store {
  private cache = {} as Cache;
  private listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();
  onError: (err: unknown) => void = (e) => console.error(e);

  constructor(readonly adapter: StorageAdapter) {
    for (const c of COLLECTIONS) (this.cache as Record<string, Map<string, unknown>>)[c] = new Map();
  }

  async load(): Promise<void> {
    await this.adapter.open();
    for (const c of COLLECTIONS) {
      const rows = await this.adapter.getAll(c);
      const m = this.map(c);
      m.clear();
      rows.forEach((r) => m.set(r.id, r));
    }
  }

  /** First run: write the starter profile, settings, food database, exercises, Back template and today's workout. */
  async seedIfEmpty(today = dateKey()): Promise<boolean> {
    if (this.map('settings').size > 0) return false;
    const now = Date.now();
    const stamp = <T extends { updatedAt: number }>(r: T): T => ({ ...r, updatedAt: now });
    this.putMany('userProfile', [stamp(defaultProfile(today))], true);
    this.putMany('settings', [stamp(defaultSettings(today))], true);
    this.putMany('foods', SEED_FOODS.map(stamp), true);
    this.putMany('exercises', SEED_EXERCISES.map(stamp), true);
    this.putMany('workoutTemplates', [stamp(BACK_TEMPLATE)], true);
    this.putMany('mealPlans', [stamp(defaultMealPlan())], true);
    this.putMany('workouts', [workoutFromTemplate(BACK_TEMPLATE, today, uid, now)], true);
    await this.flush();
    this.emit();
    return true;
  }

  private map<K extends CollectionName>(name: K): Map<string, Collections[K]> {
    return this.cache[name] as Map<string, Collections[K]>;
  }

  all<K extends CollectionName>(name: K): Collections[K][] {
    return [...this.map(name).values()];
  }

  get<K extends CollectionName>(name: K, id: string): Collections[K] | undefined {
    return this.map(name).get(id);
  }

  get settings(): Settings {
    const s = this.map('settings').get('settings');
    if (!s) throw new Error('Settings not loaded');
    return s;
  }

  get profile(): UserProfile {
    const p = this.map('userProfile').get('me');
    if (!p) throw new Error('Profile not loaded');
    return p;
  }

  private enqueue(op: () => Promise<void>) {
    this.queue = this.queue.then(op).catch((e) => this.onError(e));
  }

  /** Save a record. `silent` skips re-rendering (used while typing into an input). */
  put<K extends CollectionName>(name: K, record: Collections[K], silent = false): Collections[K] {
    const r = { ...record, updatedAt: Date.now() };
    this.map(name).set(r.id, r);
    this.enqueue(() => this.adapter.put(name, r));
    if (!silent) this.emit();
    return r;
  }

  putMany<K extends CollectionName>(name: K, records: Collections[K][], silent = false): void {
    const now = Date.now();
    const rs = records.map((r) => ({ ...r, updatedAt: r.updatedAt || now }));
    rs.forEach((r) => this.map(name).set(r.id, r));
    this.enqueue(() => this.adapter.putMany(name, rs));
    if (!silent) this.emit();
  }

  remove(name: CollectionName, id: string, silent = false): void {
    this.map(name).delete(id);
    this.enqueue(() => this.adapter.delete(name, id));
    if (!silent) this.emit();
  }

  removeWhere<K extends CollectionName>(name: K, pred: (r: Collections[K]) => boolean): void {
    for (const r of this.all(name)) if (pred(r)) this.remove(name, r.id, true);
    this.emit();
  }

  snapshot(): BackupData {
    const out = {} as BackupData;
    for (const c of COLLECTIONS) (out as Record<string, unknown[]>)[c] = this.all(c);
    return out;
  }

  async replaceAll(data: BackupData): Promise<void> {
    await this.flush();
    await this.adapter.replaceAll(data);
    await this.load();
    this.emit();
  }

  async resetAll(today = dateKey()): Promise<void> {
    await this.flush();
    await this.adapter.replaceAll({});
    await this.load();
    await this.seedIfEmpty(today);
  }

  flush(): Promise<void> {
    return this.queue;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    this.listeners.forEach((l) => l());
  }
}
