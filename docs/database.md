# Database

SQLite via `expo-sqlite`. All migrations are forward-only, versioned, and
applied by the runner in `@openpocket/database`. **Never edit or renumber an
existing migration** — add a new one.

## Conventions

- Money columns: `INTEGER` minor units.
- Rates: `INTEGER` basis points (`tax_bps`).
- Booleans: `INTEGER` 0/1.
- Timestamps: `INTEGER` epoch milliseconds.
- Ids: `TEXT` (ULID/UUID), generated in the app.
- Every business table carries `id, created_at, updated_at, device_id,
  version`. Master data (products) also carries `deleted_at` for soft delete.
- The app opens the connection with `PRAGMA foreign_keys = ON;` — FK clauses in
  the schema are only enforced when that pragma is set.

## Migration runner

```ts
import { runMigrations, MIGRATIONS } from '@openpocket/database';
// db is an adapter around expo-sqlite exposing { exec, select }
await runMigrations(db, MIGRATIONS);
```

Idempotent: applied ids are tracked in `_migrations`, each migration runs in
its own transaction, and re-running applies only what is pending. Safe to call
on every app start.

## V0.1 tables (migration `0000_init`)

| table            | purpose                                            |
| ---------------- | -------------------------------------------------- |
| `stores`         | store profile + currency config                    |
| `categories`     | optional product grouping                          |
| `products`       | catalog; `cost_price`/`selling_price` in minor units, `tax_bps`, soft delete |
| `sales`          | transaction header; unique `(store_id, invoice_no)`, `status` completed/void |
| `sale_items`     | one row per sold line, with **snapshots** of name/sku/cost/price |
| `payments`       | one or more payments per sale; generic `type` + custom `display_name` |
| `stock_movements`| auditable stock ledger; stock = SUM(`quantity_delta`) |

### Snapshots

`sale_items` stores `product_name_snapshot`, `sku_snapshot`, `unit_cost` and
`unit_price` as they were at sale time. Renaming or repricing a product later
never changes a historical invoice, and profit reports use the snapshot cost,
not today's cost.

### Deliberate V0.1 simplifications

Tracked in [roadmap.md](roadmap.md):

- `products.tax_bps` instead of a `tax_id` → `taxes` table.
- `sales.customer_id` is a nullable id with **no** customers table yet; it
  arrives in migration `0001` (V0.2). Walk-in sales leave it `NULL`.
- Quantities are integers; weighed/fractional units come later.
- Bill-level discount does not recompute the per-line tax base (see
  `pos-core/pricing.ts`).
