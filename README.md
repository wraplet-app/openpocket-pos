# OpenPocket POS

A free, open-source, **offline-first** point-of-sale for small merchants —
mini marts, grocers, cafés, bakeries, clothing shops, kiosks and home
businesses. Bill from an Android or iOS phone or tablet, no account and no
internet required.

> First-run experience: **Install → Create Store → Add Product → New Sale →
> Receive Payment → Receipt.** No login, no cloud, works on a plane.

## Principles

Offline operation · fast billing · simple UX · **correct money math** ·
auditable inventory · privacy · no mandatory account · no mandatory cloud ·
open-source extensibility · phone + tablet.

Correctness of sales, payments, stock and financial calculations matters more
than visual polish. Money is never a floating-point number.

## Monorepo layout

```
openpocket-pos/
  apps/
    mobile/       # Expo + Expo Router app            (next slice)
    api/          # optional cloud backend            (deferred, V0.5)
    web-admin/    # optional web dashboard            (deferred)
  packages/
    types/        # shared domain primitives          ✅ built
    pos-core/     # money + pricing + profit engine    ✅ built, tested
    database/     # SQLite schema + migration runner   ✅ built, tested
    inventory/    # stock-movement helpers            (next slice)
    validation/   # Zod schemas                        (next slice)
    localization/ # i18next resources                 (next slice)
    ui/           # shared RN components              (next slice)
    sync/         # optional outbox-based sync        (deferred, V0.5)
    config/       # shared eslint/tsconfig            (folded into root for now)
  docs/
```

See [docs/roadmap.md](docs/roadmap.md) for the full slice-by-slice plan and
[docs/architecture.md](docs/architecture.md) for the layering rules.

## What works today (V0.1 foundation)

- **`@openpocket/pos-core`** — deterministic integer-minor-unit money math,
  the cart pricing engine (line + bill discounts, per-line tax, split/cash
  payment settlement, suggested cash amounts) and snapshot-based profit.
  Fully unit-tested (20 tests).
- **`@openpocket/database`** — the V0.1 SQLite schema (stores, categories,
  products, sales, sale_items, payments, stock_movements) as a versioned
  migration, plus a portable, idempotent migration runner. Tested against a
  real SQLite engine (3 tests).
- **`@openpocket/types`** — shared money/id/enum types and the `SyncFields`
  every entity carries so cloud sync can be added later without restructuring.

The UI, repositories, hooks and screens are the next vertical slice — they are
intentionally **not** stubbed with fake data. Nothing here pretends to work
before its persistence layer exists.

## Develop

Requires Node ≥ 22 (built with Node 26) and pnpm 10.

```bash
pnpm install
pnpm test          # runs every package's tests
```

The core packages run with **zero build step** — Node's native TypeScript
type-stripping executes the `.ts` sources directly. See
[docs/development.md](docs/development.md).

## License

MIT — see [LICENSE](LICENSE).
