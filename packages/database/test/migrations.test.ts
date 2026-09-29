import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS, runMigrations, type SqlExecutor } from '../src/index.ts';

/** Adapt node:sqlite's sync API to the runner's async SqlExecutor. */
function adapter(db: DatabaseSync): SqlExecutor {
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    select: async <T>(sql: string) => db.prepare(sql).all() as T[],
  };
}

function tableNames(db: DatabaseSync): string[] {
  return (
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`).all() as {
      name: string;
    }[]
  ).map((r) => r.name);
}

test('runMigrations applies all schema migrations in order', async () => {
  const db = new DatabaseSync(':memory:');
  const applied = await runMigrations(adapter(db), MIGRATIONS);
  assert.deepEqual(applied, ['0000_init', '0001_customers', '0002_returns', '0003_suppliers', '0004_staff', '0005_sync']);

  const tables = tableNames(db);
  for (const t of [
    'stores',
    'categories',
    'products',
    'sales',
    'sale_items',
    'payments',
    'stock_movements',
    'customers',
    'customer_ledger',
    'returns',
    'return_items',
    'suppliers',
    'purchases',
    'purchase_items',
    'staff',
    '_migrations',
  ]) {
    assert.ok(tables.includes(t), `expected table ${t}, got ${tables.join(', ')}`);
  }
});

test('customer balance derives from ledger entries', async () => {
  const db = new DatabaseSync(':memory:');
  await runMigrations(adapter(db), MIGRATIONS);
  db.exec(`INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id,version)
           VALUES ('s1','Shop','PKR','en-PK',2,0,0,'d1',1);`);
  db.exec(`INSERT INTO customers (id,store_id,name,created_at,updated_at,device_id,version)
           VALUES ('c1','s1','Ali',0,0,'d1',1);`);
  // credit sale +13000, payment -5000  => balance 8000
  db.exec(`INSERT INTO customer_ledger (id,store_id,customer_id,type,amount,created_at,device_id)
           VALUES ('l1','s1','c1','sale',13000,0,'d1'), ('l2','s1','c1','payment',-5000,0,'d1');`);
  const row = db.prepare(`SELECT COALESCE(SUM(amount),0) AS bal FROM customer_ledger WHERE customer_id='c1'`).get() as { bal: number };
  assert.equal(row.bal, 8000);
});

test('runMigrations is idempotent', async () => {
  const db = new DatabaseSync(':memory:');
  await runMigrations(adapter(db), MIGRATIONS);
  const second = await runMigrations(adapter(db), MIGRATIONS);
  assert.deepEqual(second, []);
});

test('schema enforces money CHECK constraints', async () => {
  const db = new DatabaseSync(':memory:');
  await runMigrations(adapter(db), MIGRATIONS);
  db.exec(
    `INSERT INTO stores (id,name,currency_code,currency_locale,currency_decimals,created_at,updated_at,device_id,version)
     VALUES ('s1','Shop','PKR','en-PK',2,0,0,'d1',1);`,
  );
  // negative selling_price must be rejected by CHECK (selling_price >= 0)
  assert.throws(() =>
    db.exec(
      `INSERT INTO products (id,store_id,name,selling_price,created_at,updated_at,device_id,version)
       VALUES ('p1','s1','Bad',-100,0,0,'d1',1);`,
    ),
  );
});
