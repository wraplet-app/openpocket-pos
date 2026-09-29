/**
 * Cloud sync client. The local SQLite DB stays the source of truth; sync is a
 * background reconcile against the OpenPocket Cloudflare Worker (+ D1).
 *
 *  - PUSH: send local rows changed since the last push cursor.
 *  - PULL: fetch this store's rows changed since the last pull cursor and upsert
 *    them locally (last-writer-wins for mutable rows, insert-if-absent for
 *    append rows — the same SQL the server uses).
 *
 * Cursors are row timestamps with a safety overlap, so brief clock skew between
 * a shop's phones can only ever re-send a row (idempotent), never drop one.
 * ponytail: timestamp cursor + overlap. Swap to a server sequence column only
 * if you ever run many devices with badly unsynced clocks.
 */
import {
  SYNC_TABLES, upsertSql, rowValues, changedSinceSql, type SyncTable,
} from '@openpocket/database';
import { getDb } from './db';
import { getStore } from './repos';

const OVERLAP_MS = 30_000;

export interface SyncState {
  server_url: string | null;
  token: string | null;
  last_pushed_at: number;
  last_pulled_at: number;
  last_synced_at: number | null;
}

export async function getSyncState(): Promise<SyncState> {
  const row = await getDb().getFirstAsync<SyncState>('SELECT server_url, token, last_pushed_at, last_pulled_at, last_synced_at FROM sync_state WHERE id = 1');
  return row ?? { server_url: null, token: null, last_pushed_at: 0, last_pulled_at: 0, last_synced_at: null };
}

export function isConfigured(s: SyncState): boolean {
  return !!(s.server_url && s.token);
}

export async function saveSyncConfig(serverUrl: string, token: string): Promise<void> {
  const url = serverUrl.trim().replace(/\/+$/, '');
  await getDb().runAsync('UPDATE sync_state SET server_url = ?, token = ? WHERE id = 1', [url, token.trim()]);
}

export async function disconnectSync(): Promise<void> {
  await getDb().runAsync('UPDATE sync_state SET server_url = NULL, token = NULL, last_pushed_at = 0, last_pulled_at = 0, last_synced_at = NULL WHERE id = 1');
}

async function api(base: string, path: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  if (!res.ok) throw new Error(body?.error ?? `Sync failed (${res.status})`);
  return body;
}

/** Bind this store to the token on the server (idempotent). */
async function register(base: string, token: string, storeId: string): Promise<void> {
  await api(base, '/sync/register', token, { method: 'POST', body: JSON.stringify({ storeId }) });
}

async function pushChanges(base: string, token: string, since: number): Promise<number> {
  const db = getDb();
  const tables: Record<string, unknown[]> = {};
  let maxTime = since;
  const from = Math.max(0, since - OVERLAP_MS);
  for (const t of SYNC_TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(changedSinceSql(t), [from]);
    if (rows.length === 0) continue;
    tables[t.name] = rows;
    for (const r of rows) {
      const ts = Number(r[t.timeColumn]);
      if (Number.isFinite(ts) && ts > maxTime) maxTime = ts;
    }
  }
  if (Object.keys(tables).length === 0) return since;
  await api(base, '/sync/push', token, { method: 'POST', body: JSON.stringify({ tables }) });
  return maxTime;
}

/** Apply a server pull payload locally (FK off; parents-before-children order). */
async function applyPull(payload: { tables: Record<string, Record<string, unknown>[]> }): Promise<number> {
  const db = getDb();
  let applied = 0;
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const t of SYNC_TABLES) {
        const rows = payload.tables[t.name];
        if (!Array.isArray(rows)) continue;
        const sql = upsertSql(t);
        for (const row of rows) {
          await db.runAsync(sql, rowValues(t, row) as (string | number | null)[]);
          applied++;
        }
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return applied;
}

async function pullChanges(base: string, token: string, since: number): Promise<number> {
  const from = Math.max(0, since - OVERLAP_MS);
  const payload = await api(base, `/sync/pull?since=${from}`, token, { method: 'GET' });
  await applyPull(payload);
  return typeof payload.cursor === 'number' ? payload.cursor : since;
}

export interface SyncResult { pushedCursor: number; pulledCursor: number; at: number }

/** Full reconcile for the device already bound to this store: push then pull. */
export async function syncNow(): Promise<SyncResult> {
  const state = await getSyncState();
  if (!isConfigured(state)) throw new Error('Cloud sync is not set up yet');
  const store = await getStore();
  if (!store) throw new Error('No store to sync');
  const base = state.server_url!;
  const token = state.token!;

  await register(base, token, store.id);
  const pushedCursor = await pushChanges(base, token, state.last_pushed_at);
  const pulledCursor = await pullChanges(base, token, state.last_pulled_at);
  const at = Date.now();
  await getDb().runAsync(
    'UPDATE sync_state SET last_pushed_at = ?, last_pulled_at = ?, last_synced_at = ? WHERE id = 1',
    [pushedCursor, pulledCursor, at],
  );
  return { pushedCursor, pulledCursor, at };
}

/**
 * Adopt a store from the cloud onto a fresh/second device: wipe local synced
 * data, pull everything for the token's store, and save the config. Destructive
 * — the UI confirms first. Caller reloads the session afterward.
 */
export async function restoreFromCloud(serverUrl: string, token: string): Promise<number> {
  const base = serverUrl.trim().replace(/\/+$/, '');
  const tk = token.trim();
  // Verify the token resolves to a store before wiping anything.
  const payload = await api(base, '/sync/pull?since=0', tk, { method: 'GET' });
  const db = getDb();
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (let i = SYNC_TABLES.length - 1; i >= 0; i--) await db.runAsync(`DELETE FROM "${SYNC_TABLES[i]!.name}"`);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  const applied = await applyPull(payload);
  const cursor = typeof payload.cursor === 'number' ? payload.cursor : Date.now();
  await saveSyncConfig(base, tk);
  await db.runAsync('UPDATE sync_state SET last_pulled_at = ?, last_synced_at = ? WHERE id = 1', [cursor, Date.now()]);
  return applied;
}
