export { runMigrations, type Migration, type SqlExecutor } from './runner.ts';
export {
  SYNC_TABLES, upsertSql, rowValues, changedSinceSql, pullSql, rowStoreId,
  type SyncTable, type SyncMode, type StoreScope,
} from './sync.ts';
import { migration as m0000 } from './migrations/0000_init.ts';
import { migration as m0001 } from './migrations/0001_customers.ts';
import { migration as m0002 } from './migrations/0002_returns.ts';
import { migration as m0003 } from './migrations/0003_suppliers.ts';
import { migration as m0004 } from './migrations/0004_staff.ts';
import { migration as m0005 } from './migrations/0005_sync.ts';
import { migration as m0006 } from './migrations/0006_store_profile.ts';

/** Ordered list of all migrations. Append new ones; never edit or remove. */
export const MIGRATIONS = [m0000, m0001, m0002, m0003, m0004, m0005, m0006] as const;
