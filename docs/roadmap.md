# Roadmap

Built vertically: each module goes migration → repository → domain/service →
hooks → UI → tests, and is verified before the next begins. Cloud sync is not
built until local POS is reliable.

## V0.1 — foundation & core POS

1. ✅ Project foundation (monorepo, tsconfig, tests, docs)
2. ✅ SQLite schema + migration runner (`0000_init`)
3. ✅ Money + pricing engine (`pos-core`, tested)
4. ⬜ Store onboarding — repository + screen
5. ⬜ Categories — repository + screen
6. ⬜ Products + product search (name / SKU / barcode)
7. ⬜ POS cart (Zustand ephemeral state) wired to the pricing engine
8. ⬜ Cash checkout (total / received / change, insufficient-payment guard)
9. ⬜ Atomic sale write (sale + items + payments + stock movements)
10. ⬜ Sales history
11. ⬜ Dashboard (today's sales, count, payment methods, low stock)
12. ⬜ Basic settings (store, currency, theme)

**Next slice starts at step 4**, plus `apps/mobile` (Expo + Expo Router),
`packages/validation` (Zod), `packages/localization` (i18next, English first)
and the expo-sqlite adapter for the migration runner.

## V0.2
Barcode scanning · customers (+ `0001` migration) · customer credit ledger ·
expenses · basic reports · PDF/shareable receipts · CSV product import/export.

## V0.3
Returns/refunds (explicit reversal transactions) · suppliers · purchases ·
advanced inventory · low-stock notifications · bill-discount tax
redistribution.

## V0.4
Thermal printer (ESC/POS) · employee PINs · roles (owner/manager/cashier) ·
audit logs.

## V0.5
Optional account system · cloud backup · outbox-based sync engine ·
multi-device (inventory synced as movements, never absolute counts).

## V1.0
Production-ready Android + iOS · stable migrations · reliable offline ·
backup/restore · full docs · localization (Urdu, Arabic, Spanish, French,
Hindi, Bengali, Indonesian + community) with RTL · tested financials.

## Deferred design decisions (revisit when the slice arrives)

- `taxes` table + `tax_id` on products (currently `tax_bps` inline).
- Fractional/weighed quantities in `sale_items`.
- Bill-level discount reducing the per-line tax base.
- `ReceiptPrinter` adapters (Bluetooth ESC/POS, network, PDF, system print).
- Backup adapters (local file, Google Drive, iCloud, self-hosted, cloud).
