# Architecture

## Layering

Four layers, one-directional dependencies. UI never reaches persistence
directly, and business logic never imports React Native.

```
UI (screens, components)            apps/mobile
        │ calls
Application / service logic          apps/mobile/services, hooks
        │ calls
Domain / business logic              packages/pos-core, inventory
        │ uses
Persistence                          packages/database (SQLite)
```

Rules:

- **UI components contain no business logic.** Price, tax, discount and change
  math lives in `pos-core`, not in a component. A component calls a pure
  function and renders the result.
- **Domain packages are framework-free.** `pos-core`, `database`, `types`,
  `inventory`, `validation` import nothing from React Native. They run under
  Node (that is how they are tested) and under Metro.
- Functions are small and independently testable. Prefer composition over
  large classes or god-objects.

## Money

Money is an integer count of a currency's **minor units** (`Minor`), never a
float. Rates (tax, percentage discounts) are integer **basis points** (`Bps`,
1% = 100). All arithmetic goes through `pos-core/money.ts`, which has the
single rounding point in the app (round-half-away-from-zero, applied only when
a percentage forces a fractional unit). Currency `decimals` lives on the
store's config, so the same integer means paisa, cents or whole yen depending
on the store.

## Identifiers & sync-readiness

Business entities use string ids (ULID/UUID), generated at the edge, never
auto-increment. Every syncable table carries `SyncFields`
(`id, created_at, updated_at, device_id, version`) from day one so the optional
sync module (V0.5) needs no schema restructuring — see
[docs/database.md](database.md).

## Offline-first

SQLite (via `expo-sqlite`) is the operational database and the source of
truth. Product creation, billing, payments, inventory and reports all work
with no network. Zustand holds only ephemeral UI state (cart, selected
customer, filters, modal visibility) — never durable business data. Reports
query the database, not in-memory state.

## Atomic sales

Completing a sale writes the `sales` row, its `sale_items`, its `payments`, and
the negative `stock_movements` **inside one SQLite transaction**. It all
commits or all rolls back; a partially recorded sale is never possible. The
migration runner uses the same transaction discipline.

## Inventory as an audit log

Stock is derived from `stock_movements` (sum of `quantity_delta` per product),
not stored as a mutable `products.stock` number. Every change records *why*
(sale, return, adjustment, damage, purchase…). This is also what makes
multi-device inventory sync correct later: devices exchange movements, not
absolute counts, so concurrent sales don't clobber each other.

## Printer & backup abstractions (designed, deferred)

Receipts are a plain data model independent of any printer. A `ReceiptPrinter`
interface (`print(receipt)`) will have adapters for Bluetooth ESC/POS, network,
PDF and the system print dialog — none is a blocking dependency for V0.1.
Backup/restore and CSV import/export are likewise abstracted from the UI.
