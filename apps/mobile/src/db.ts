import * as SQLite from 'expo-sqlite';
import { MIGRATIONS, runMigrations, type SqlExecutor } from '@openpocket/database';

let _db: SQLite.SQLiteDatabase | null = null;

/** Open the on-device database and run pending migrations. Call once at boot. */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  const db = await SQLite.openDatabaseAsync('openpocket.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const exec: SqlExecutor = {
    exec: async (sql) => {
      await db.execAsync(sql);
    },
    select: async <T>(sql: string) => (await db.getAllAsync<any>(sql)) as T[],
  };
  await runMigrations(exec, MIGRATIONS);
  _db = db;
  return db;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('Database not initialized — call initDatabase() first');
  return _db;
}
