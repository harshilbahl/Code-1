import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeBackup, validateBackup } from '../src/data/backup.js';
import { MemoryAdapter } from '../src/data/memory.js';
import { Store } from '../src/data/store.js';

function kv() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

test('seed on first run, persist across reload, and not reseed', async () => {
  const storage = kv();
  const s1 = new Store(new MemoryAdapter(storage));
  await s1.load();
  assert.equal(await s1.seedIfEmpty('2026-09-25'), true);
  assert.equal(s1.settings.calorieTarget, 2400);
  assert.equal(s1.all('workouts').length, 1);
  assert.equal(s1.all('workouts')[0].exercises.length, 8);
  s1.put('bodyWeight', { id: 'b1', updatedAt: 0, date: '2026-09-25', weightKg: 60.2, note: '' });
  await s1.flush();

  const s2 = new Store(new MemoryAdapter(storage));
  await s2.load();
  assert.equal(await s2.seedIfEmpty('2026-09-25'), false);
  assert.equal(s2.get('bodyWeight', 'b1')?.weightKg, 60.2);
});

test('export → import round trip, and invalid files are rejected', async () => {
  const a = new Store(new MemoryAdapter());
  await a.load();
  await a.seedIfEmpty('2026-09-25');
  a.put('bodyWeight', { id: 'b1', updatedAt: 0, date: '2026-09-25', weightKg: 60.2, note: 'morning' });
  const json = JSON.parse(JSON.stringify(makeBackup(a.snapshot())));

  const v = validateBackup(json);
  assert.equal(v.ok, true);
  const b = new Store(new MemoryAdapter());
  await b.load();
  await b.replaceAll(v.backup!.data);
  assert.equal(b.get('bodyWeight', 'b1')?.note, 'morning');
  assert.equal(b.all('foods').length, a.all('foods').length);

  assert.equal(validateBackup({ foo: 1 }).ok, false);
  assert.equal(validateBackup({ ...json, schemaVersion: 99 }).ok, false);
  assert.equal(validateBackup({ ...json, data: { meals: [{ noId: true }] } }).ok, false);
});

test('reset clears data and reseeds defaults', async () => {
  const s = new Store(new MemoryAdapter());
  await s.load();
  await s.seedIfEmpty('2026-09-25');
  s.put('bodyWeight', { id: 'b1', updatedAt: 0, date: '2026-09-25', weightKg: 60.2, note: '' });
  await s.resetAll('2026-09-25');
  assert.equal(s.all('bodyWeight').length, 0);
  assert.equal(s.settings.proteinTarget, 130);
});
