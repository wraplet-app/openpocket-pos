# OpenPocket POS — Handoff

An **offline-first mobile point-of-sale** for small shops. Runs entirely on the
phone (local SQLite), with optional Cloudflare cloud sync. Money is always
integer minor units — never floats.

This doc is the pick-up point to continue at home. It covers what exists, how to
run it, where everything lives, and what's next.

---

## 1. Quick start (get it running)

Prereqs: **Node ≥ 22**, **pnpm 10** (`corepack enable`), Android Studio +
an emulator (or a physical Android phone with USB debugging), Java 17.

```bash
git clone https://github.com/wraplet-app/openpocket-pos.git
cd openpocket-pos
pnpm install
```

Run the logic tests (no device needed):

```bash
pnpm test          # pos-core (money/pricing) + database (migrations, sync)
```

Run the app on Android:

```bash
cd apps/mobile
pnpm exec expo prebuild            # first time only (generates android/)
pnpm exec expo run:android         # builds + installs the dev client
# then, in another terminal, the Metro bundler:
pnpm exec expo start --dev-client
```

Handy loop while developing (after the dev client is installed once): just run
`expo start --dev-client` and reload. To reload on the emulator via adb:

```bash
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW \
  -d "openpocketpos://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" io.openpocket.pos
```

**Seed demo data (one tap):** on a fresh install, the setup screen shows a
**"Load demo shop (dev)"** button (dev builds only). It creates "Maple Street
Market" (USD): a full shop profile with logo and a customised receipt, 24 real
products in 4 categories with real barcodes and photos, 2 staff (**owner Alex,
PIN 1234**; **cashier Sam, PIN 5678**), 3 customers and a mix of
cash/card/credit sales — via `apps/mobile/src/seed.ts`. To reset the demo,
clear the app's data (`adb shell pm clear io.openpocket.pos`).

**Record a feature tour** (emulator running, demo shop loaded):
`powershell -File scripts\demo-tour.ps1 [-Record] [-Dwell 1.0]` walks through every
feature at ~1 second each (`-Record` saves an mp4 to the Desktop).

> **Windows note:** the repo must live at a short path (e.g. `C:\opos`). Deep
> paths blow past Windows' path limit during the Android build. `.npmrc` sets
> `node-linker=hoisted` for RN compatibility.

---

## 2. What it is / architecture

**Monorepo** (pnpm workspaces + Turborepo):

```
apps/
  mobile/        Expo + Expo Router app (the POS)
  sync-worker/   Cloudflare Worker + D1 (cloud sync backend) — NOT deployed yet
packages/
  pos-core/      money math, pricing, profit, CSV — pure TS, fully tested
  database/      migrations, migration runner, sync metadata/SQL — pure TS, tested
  types/         shared types
docs/            architecture, database, development, roadmap
```

**Stack:** React Native 0.86 / React 19 / Expo 57, Expo Router, TypeScript,
expo-sqlite, Zustand (UI state), @expo/vector-icons (Ionicons). No Redux, no
backend required to run.

**Design rules (keep these):**
- Money is **integer minor units** via a branded `Minor` type. Never float.
- **All SQL lives in one file:** `apps/mobile/src/repos.ts`. Screens never write SQL.
- Money/pricing math lives in `@openpocket/pos-core`. Screens never compute totals.
- Every business table carries **sync fields**: `id` (UUID), `created_at`,
  `updated_at`, `device_id`, `version`. Ledgers/events are append-only.
- Balances are **derived, never stored** (customer credit = SUM(ledger)).
- Returns/refunds are **separate transactions** — never edit or delete a sale.
- Historical data is **snapshotted** on sale_items (price/cost/name at sale time).

---

## 2b. UI conventions (keep these)

Every screen is built from the same few pieces so headers, safe areas and scrolling
behave identically everywhere (see `apps/mobile/src/pos/Screen.tsx`, `kit.tsx`, and the
tokens at the bottom of `src/theme.ts`):

- `<Screen title right footer scroll>` — fixed header with back button, scrolling body,
  optional pinned `footer` (Save buttons). Never hand-roll a header or use
  `insets.top` in a screen.
- `<TabHeader>` — large fixed header for the five bottom-tab screens; the list below it scrolls.
- `SearchField`, `Chip`/`ChipRow`, `EmptyState`, `PrimaryButton` — shared controls.
- Spread `listProps` / `scrollProps` on lists for smooth virtualised scrolling; no shadows on list rows.
- Use `space` / `radius` / `type` tokens instead of magic numbers.
- Nothing is currency- or country-specific: money always goes through `useMoney` / `format`,
  the setup currency defaults from the device region, and the demo shop is a US-style
  market ("Maple Street Market", USD). Sample product photos are credited in
  `apps/mobile/assets/demo/ATTRIBUTION.md`.

---

## 3. Where things live (map)

**App screens** — `apps/mobile/app/` (Expo Router file routes):
- `_layout.tsx` — DB init, session load, Onboarding gate, **StaffLock** (PIN) gate.
- `(tabs)/` — Home, Products, Scan (center button), Sales, More.
- `scan.tsx` — camera-in-a-card + live "Recently added" list with steppers.
- `add-product.tsx` — incl. **barcode → name+photo** via Open Food Facts.
- `sale/[id].tsx` — sale detail, returns (role-gated), reprint + **share PDF**.
- `customers.tsx`, `customer/[id].tsx`, `add-customer.tsx` — customers + credit.
- `suppliers.tsx`, `purchases.tsx`, `new-purchase.tsx`, `add-supplier.tsx`.
- `staff.tsx`, `add-staff.tsx` — staff & roles.
- `store-settings.tsx` — **Shop profile & receipts** (owner only): logo, contact details,
  tax id, receipt paper/color/footer/terms with a live preview.
- `reports.tsx`, `data.tsx` (Backup/CSV + full JSON backup/restore), `cloud-sync.tsx`.

**App logic** — `apps/mobile/src/`:
- `repos.ts` — **the only SQL file** (products, checkout, customers/ledger,
  returns, suppliers/purchases, staff, reports, CSV rows).
- `db.ts` — opens SQLite, runs migrations. `id.ts` — UUID + device id.
- `session.ts` — store + signed-in staff + role (Zustand). `roles.ts` — roles,
  capabilities, PIN hashing.
- `cart.ts`, `checkoutUI.ts`, `purchaseDraft.ts` — UI state stores.
- `print.ts` — A4 invoice HTML → print + PDF share. `backup.ts` — CSV + full
  JSON backup/restore. `sync.ts` — cloud sync engine. `pos/` — shared UI
  components (CheckoutSheet, ReceiptModal, CartBar, Thumb, StaffLock, ui.tsx…),
  `images.ts` (camera/gallery), `lookup.ts` (Open Food Facts).

**Shared packages** — `packages/`:
- `pos-core/src/` — `money.ts`, `pricing.ts`, `profit.ts`, `csv.ts`.
- `database/src/` — `runner.ts`, `migrations/0000..0005`, `sync.ts` (sync table
  metadata + portable upsert/pull SQL shared with the Worker).

---

## 4. Database & migrations

On-device SQLite, migrated forward-only at boot (`runMigrations`). Never edit an
applied migration — add a new numbered one and append it to `MIGRATIONS` in
`packages/database/src/index.ts`.

| # | file | adds |
|---|------|------|
| 0000 | init | stores, categories, products, sales, sale_items, payments, stock_movements |
| 0001 | customers | customers, customer_ledger (derived balance) |
| 0002 | returns | returns, return_items |
| 0003 | suppliers | suppliers, purchases, purchase_items |
| 0004 | staff | staff (+ `sales.staff_id`) |
| 0005 | sync | `sync_state` (local-only cloud config + cursors) |
| 0006 | store_profile | shop profile (email, website, tax id, tagline, logo) + receipt settings (footer, terms, color, paper size, show/hide toggles) on `stores` |

Tests: `packages/database/test/` — migrations, sync merge, and a full
device→server→device round-trip. `packages/pos-core/test/` — money/pricing.

---

## 5. Features implemented

- **Sell:** catalog + quick sale, cart, checkout (cash/card/transfer/credit),
  change, tax, whole-order discount. Barcode scan-to-cart.
- **Scan screen:** camera in a card, manual code entry, live "recently added"
  list with steppers, checkout bar. Works for restock too.
- **Products:** search (name/barcode), filters (all/low/out of stock),
  camera/gallery photos, **auto name+photo from a barcode** (Open Food Facts,
  downloaded locally so it stays offline).
- **Customers & credit:** ledger-based balance, credit sales, payments,
  per-customer statement, "owes credit" filter.
- **Reports:** today/7d/30d — sales, gross profit, refunds, discounts, net,
  payment-method breakdown, best sellers, low stock.
- **Returns/refunds:** partial, prorated, stock returned, account refunds to
  ledger. Manager/owner only.
- **Suppliers & purchases:** restock updates cost + stock; scan-to-restock.
- **Sales history:** search + date/payment filters; per-sale detail with staff
  attribution; **A4 PDF invoice** print + share.
- **Staff & roles:** owner/manager/cashier, 4-digit PIN lock ("Who's working?"),
  role-gated menus, sale attribution ("Served by …") on screen + receipt.
- **Backup:** CSV export/import; **full-DB JSON backup + restore**.
- **Cloud sync (built, not deployed):** see §6.

---

## 6. Cloud sync (Cloudflare) — built, NOT deployed yet

Backend lives in `apps/sync-worker/` (Cloudflare **Worker + D1**). Kept separate
from the "Milo" project on the same Cloudflare account — everything is named
`openpocket-*`. The engine (last-writer-wins for mutable rows, insert-if-absent
for ledgers, store-scoped pulls) is shared with the app via
`@openpocket/database` and is covered by an end-to-end round-trip test.

**To deploy when ready** (`apps/sync-worker/README.md` has the full version):

```bash
cd apps/sync-worker
pnpm install
pnpm wrangler login
pnpm db:create        # prints database_id → paste into wrangler.toml
pnpm db:schema        # apply schema.sql to remote D1
pnpm deploy           # prints the Worker URL
```

Then in the app: **More → Cloud sync** → paste the Worker URL → **Generate**
token → **Connect & sync**. Second device: same URL + token → **Restore this
device from cloud**.

> Not yet done: the actual `wrangler` deploy against the live account (held on
> purpose). Product **images** are local files and are not synced (data syncs;
> re-add photos per device, or add R2 image sync later).

---

## 7. Current state & what's next

**Shop branding & receipts (new):** onboarding is two steps — shop details (logo, name,
tagline, phone, email, website, address, tax id, currency) then receipt design (A4 /
80 mm / 58 mm, accent color, thank-you message, terms, show/hide logo · contact ·
"served by") with a live preview. Everything is editable later in More → Shop profile &
receipts (owner only) and drives the printed/PDF invoice (`src/print.ts`) and the
on-screen receipt. Pure helpers + tests live in `src/branding.ts`. The logo file is
device-local (not synced); all text fields sync.

**Products (new):** category, SKU, unit, per-product low-stock level, margin hint, and an
edit screen (pencil on each card → `add-product?id=…`). Products tab has one fixed
filter row (stock filters + category chips) and searches name/barcode/SKU/category.

**Design pass (new):** every screen uses the shared `Screen` / `TabHeader` layout (see
§2b): fixed headers, safe-area aware footers, virtualised smooth lists. Nothing is
country-specific: currency defaults from the device region (10 offered), quick-cash
buttons scale to the sale, and the demo data is a generic US-style market.

**Done & verified on the Android emulator:** onboarding, sell/checkout (cash,
split, credit), returns, credit ledger, reports (numbers cross-checked),
purchases restock, CSV export/import, full JSON backup, thermal/A4 print + PDF
share, staff PIN lock + role gating, barcode name/photo lookup, redesigned scan
screen, search/filters. Cloud sync engine passes an end-to-end test suite.

**Known ceilings / follow-ups:**
- **Deploy the sync Worker** to Cloudflare, then smoke-test real multi-device
  sync on two phones.
- Real barcode decode only works on a **physical phone** (emulator camera can't
  present a real code) — manual entry works everywhere.
- `tsc --noEmit` reports a few **pre-existing** type quirks in the app
  (`Minor`/`CurrencyConfig` re-exports, an `absoluteFillObject`); Metro
  type-strips and the app runs fine. Worth cleaning up but not blocking.
- Sync uses a timestamp cursor + 30s overlap (fine for a shop's phones); switch
  to a server sequence column if you ever run many badly clock-skewed devices.
- Push sends changed rows in one request — chunk it if a device ever has many
  thousands of unsynced rows.
- Image sync (R2) — product photos and the shop logo are local files; roles beyond 3
  tiers and web/iOS builds are open runway.
- Not yet verified on hardware: a real thermal printer at 58/80 mm, and real-camera
  barcode decode (emulator only shows a fake room).
- The A4/thermal receipt HTML was checked in a browser and via the PDF share flow, not
  on every printer driver.
- `tsc --noEmit` still shows the pre-existing `Minor`/`CurrencyConfig` re-export errors
  (plus the same two in the new `StoreProfileForm.tsx` / `*.test.ts` imports); Metro
  strips types so the app runs. Fixing the `pos-core` re-exports clears nearly all of them.
- Demo product photos come from Open Food Facts / Open Beauty Facts (CC BY-SA) — keep
  `apps/mobile/assets/demo/ATTRIBUTION.md` with them if you redistribute.
- The sync worker's `schema.sql` includes the new `stores` columns but is still not deployed.

**How to continue:** `pnpm install`, `pnpm test`, run the app (§1). Pick the next
item, add a migration if the schema changes, keep SQL in `repos.ts` and money in
`pos-core`, and add a test alongside any non-trivial logic.
