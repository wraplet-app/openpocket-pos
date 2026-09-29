import {
  SYNC_TABLES, upsertSql, rowValues, pullSql, rowStoreId, type SyncTable,
} from '@openpocket/database';

export interface Env {
  DB: D1Database;
}

type Row = Record<string, unknown>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });

function bearer(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
}

async function storeForToken(env: Env, token: string): Promise<string | null> {
  if (!token) return null;
  const row = await env.DB.prepare('SELECT store_id FROM sync_tokens WHERE token = ?').bind(token).first<{ store_id: string }>();
  return row?.store_id ?? null;
}

const bind = (v: unknown[]) => v as (string | number | null)[];

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'openpocket-sync', tables: SYNC_TABLES.length });
    }

    const token = bearer(req);

    // Bind a token to a store the first time a device connects. Idempotent for
    // the same (token, store); refuses to point an existing token elsewhere.
    if (url.pathname === '/sync/register' && req.method === 'POST') {
      const body = await req.json<{ storeId?: string }>().catch(() => ({}));
      const storeId = body.storeId;
      if (!token || !storeId) return json({ error: 'token and storeId are required' }, 400);
      const existing = await storeForToken(env, token);
      if (existing && existing !== storeId) return json({ error: 'token already bound to another store' }, 409);
      if (!existing) {
        await env.DB.prepare('INSERT INTO sync_tokens (token, store_id, created_at) VALUES (?,?,?)')
          .bind(token, storeId, Date.now()).run();
      }
      return json({ ok: true, storeId });
    }

    const storeId = await storeForToken(env, token);
    if (!storeId) return json({ error: 'unauthorized' }, 401);

    // Upsert rows uploaded by a device. Parents before children; cross-store
    // rows are rejected. Mutable rows resolve by last-writer-wins (in the SQL);
    // append rows are inserted only if absent.
    if (url.pathname === '/sync/push' && req.method === 'POST') {
      const body = await req.json<{ tables?: Record<string, Row[]> }>().catch(() => ({}));
      const tables = body.tables ?? {};
      let applied = 0;
      for (const t of SYNC_TABLES) {
        const rows = tables[t.name];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const stmt = env.DB.prepare(upsertSql(t));
        const batch = [] as D1PreparedStatement[];
        for (const row of rows) {
          const owner = rowStoreId(t, row);
          if (owner !== null && owner !== storeId) continue; // never write another store's data
          batch.push(stmt.bind(...bind(rowValues(t, row))));
        }
        if (batch.length) { await env.DB.batch(batch); applied += batch.length; }
      }
      return json({ ok: true, applied, serverTime: Date.now() });
    }

    // Return this store's rows changed after `since`. The cursor is the newest
    // row time seen, so the device asks for strictly newer rows next time.
    if (url.pathname === '/sync/pull' && req.method === 'GET') {
      const since = Number(url.searchParams.get('since') ?? '0') || 0;
      const out: Record<string, Row[]> = {};
      let cursor = since;
      for (const t of SYNC_TABLES) {
        const res = await env.DB.prepare(pullSql(t)).bind(storeId, since).all<Row>();
        const rows = res.results ?? [];
        out[t.name] = rows;
        for (const r of rows) {
          const ts = Number(r[(t as SyncTable).timeColumn]);
          if (Number.isFinite(ts) && ts > cursor) cursor = ts;
        }
      }
      return json({ ok: true, tables: out, cursor });
    }

    return json({ error: 'not found' }, 404);
  },
};
