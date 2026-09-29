/**
 * Portable, forward-only migration runner. Depends on nothing from
 * expo-sqlite or node:sqlite directly — the caller passes a tiny executor
 * so the same runner works on device, in tests, and in tooling.
 */

export interface Migration {
  /** Sortable, immutable id, e.g. "0000_init". Never reuse or renumber. */
  readonly id: string;
  /** One or more DDL/DML statements. Applied inside a transaction. */
  readonly sql: string;
}

/** Minimal database surface the runner needs. Adapters live at the call site. */
export interface SqlExecutor {
  /** Run one or more statements with no result. */
  exec(sql: string): Promise<void>;
  /** Run a query and return all rows. */
  select<T>(sql: string): Promise<T[]>;
}

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  id         TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);`;

/**
 * Apply every migration not yet recorded, in id order, each in its own
 * transaction. Idempotent: already-applied migrations are skipped, so it is
 * safe to call on every app start. Returns the ids that were applied this run.
 */
export async function runMigrations(
  db: SqlExecutor,
  migrations: readonly Migration[],
): Promise<string[]> {
  await db.exec(MIGRATIONS_TABLE);
  const appliedRows = await db.select<{ id: string }>(`SELECT id FROM _migrations;`);
  const applied = new Set(appliedRows.map((r) => r.id));

  const pending = [...migrations]
    .filter((m) => !applied.has(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const done: string[] = [];
  for (const m of pending) {
    await db.exec('BEGIN;');
    try {
      await db.exec(m.sql);
      // Migration ids are code constants, never user input — safe to inline.
      await db.exec(
        `INSERT INTO _migrations (id, applied_at) VALUES ('${m.id}', ${Date.now()});`,
      );
      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw new Error(`Migration ${m.id} failed: ${(err as Error).message}`, { cause: err });
    }
    done.push(m.id);
  }
  return done;
}
