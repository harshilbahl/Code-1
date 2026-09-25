import { COLLECTIONS, type CollectionName, type Collections } from '../domain/types.js';

export const BACKUP_APP = 'regain';
export const SCHEMA_VERSION = 1;

export type BackupData = { [K in CollectionName]: Collections[K][] };

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export function makeBackup(data: BackupData, now = new Date()): BackupFile {
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  counts: Partial<Record<CollectionName, number>>;
  backup?: BackupFile;
}

/** Structural validation before anything is written. Unknown collections are ignored. */
export function validateBackup(json: unknown): ValidationResult {
  const errors: string[] = [];
  const counts: Partial<Record<CollectionName, number>> = {};
  if (!json || typeof json !== 'object') return { ok: false, errors: ['File is not a JSON object'], counts };
  const b = json as Partial<BackupFile>;
  if (b.app !== BACKUP_APP) errors.push('Not a ReGain backup (missing "app": "regain")');
  if (typeof b.schemaVersion !== 'number') errors.push('Missing schemaVersion');
  else if (b.schemaVersion > SCHEMA_VERSION) errors.push(`Backup is from a newer version (schema ${b.schemaVersion}); update the app first`);
  if (!b.data || typeof b.data !== 'object') errors.push('Missing "data" section');
  if (errors.length) return { ok: false, errors, counts };

  const data = {} as BackupData;
  for (const c of COLLECTIONS) {
    const rows = (b.data as Record<string, unknown>)[c];
    if (rows === undefined) {
      (data as Record<string, unknown[]>)[c] = [];
      continue;
    }
    if (!Array.isArray(rows)) {
      errors.push(`"${c}" must be an array`);
      continue;
    }
    const bad = rows.findIndex((r) => !r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string');
    if (bad >= 0) errors.push(`"${c}" row ${bad} has no string id`);
    (data as Record<string, unknown[]>)[c] = rows;
    counts[c] = rows.length;
  }
  if (errors.length) return { ok: false, errors, counts };
  return { ok: true, errors, counts, backup: { ...(b as BackupFile), data } };
}
