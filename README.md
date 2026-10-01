<div align="center">

# OpenPocket POS

**A free, offline-first point-of-sale that lives in your pocket.**

Run a real shop from an Android or iOS phone — sell, print receipts, track
stock and see your profit, with no account and no internet required. Optional
cloud backup and multi-device sync for **$2/month**.

[![CI](https://github.com/wraplet-app/openpocket-pos/actions/workflows/ci.yml/badge.svg)](https://github.com/wraplet-app/openpocket-pos/actions/workflows/ci.yml)
[![CodeQL](https://github.com/wraplet-app/openpocket-pos/actions/workflows/codeql.yml/badge.svg)](https://github.com/wraplet-app/openpocket-pos/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0fa678.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-0fa678)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Built with Expo](https://img.shields.io/badge/built%20with-Expo-1f6feb?logo=expo&logoColor=white)

[**Website**](https://openpocket.wraplet.app) · [**Features**](#features) · [**Documentation**](docs/) · [**Contributing**](CONTRIBUTING.md)

</div>

---

<div align="center">
  <img src="docs/screenshots/01-home.png" width="24%" alt="Home dashboard" />
  <img src="docs/screenshots/02-products.png" width="24%" alt="Product catalog" />
  <img src="docs/screenshots/03-checkout.png" width="24%" alt="Checkout" />
  <img src="docs/screenshots/05-reports.png" width="24%" alt="Reports" />
</div>

<div align="center">
  <img src="docs/screenshots/04-sale-detail.png" width="24%" alt="Sale detail & refunds" />
  <img src="docs/screenshots/06-sales.png" width="24%" alt="Sales history" />
  <img src="docs/screenshots/07-staff-lock.png" width="24%" alt="Staff sign-in" />
  <img src="docs/screenshots/08-cart-products.png" width="24%" alt="Building a cart" />
</div>

---

## Why OpenPocket

Most POS apps assume a reliable connection, a monthly subscription and a
merchant account before you can ring up a single sale. OpenPocket assumes the
opposite: a phone, a shopkeeper, and a queue of customers.

- **Works on a plane.** Every sale, product and report is stored on the device
  in SQLite. No network is ever required to sell.
- **No account to start.** Install, name your shop, and sell. Sign-up is not a
  wall in front of the product.
- **Money is correct.** All amounts are integer minor units (cents/paisa),
  never floating point. Tax, discounts and change are exact.
- **Yours to keep.** Open-source (MIT), your data stays on your device unless
  you choose to back it up.

## Features

| | |
|---|---|
| 🧾 **Fast billing** | Tap products or scan barcodes into a cart; cash, card, transfer or store credit; change and quick-cash suggestions. |
| 📦 **Inventory** | Real product photos, categories, SKUs, barcodes, per-product low-stock alerts, out-of-stock flags. |
| 📷 **Barcode scan** | Scan to sell or to add a product — with an Open Food Facts lookup that fills in name and image, saved locally for offline use. |
| 👥 **Staff & roles** | Owner / manager / cashier PINs; every sale is attributed to the cashier who made it, on screen and on the receipt. |
| 🖨️ **Receipts & invoices** | Themeable receipts (58/80mm thermal or A4), print over Bluetooth/Wi-Fi/USB, or share a proper PDF invoice. |
| 📊 **Reports** | Daily/weekly/monthly sales, gross profit, refunds, discounts, payment-method mix and best sellers. |
| 🏪 **Multi-shop** | Run several separate shops on one device, each with its own products, staff, receipts and books. |
| ☁️ **Cloud sync** *(optional, $2/mo)* | Back up your shop and sync across devices. Offline selling stays free forever. |
| 🌙 **Dark mode** | Full light/dark theming throughout. |

## Pricing

- **Offline POS — free, forever.** Selling, inventory, staff, receipts and
  reports never cost anything and never need a connection.
- **Cloud sync — $2/month.** Automatic backup and multi-device sync, billed
  through the app store. Cancel anytime.

## Tech

React Native (Expo + Expo Router) · TypeScript · SQLite · Zustand ·
pnpm + Turborepo monorepo · Cloudflare Worker + D1 for optional sync ·
in-app subscriptions via Google Play / App Store (expo-iap).

```
openpocket-pos/
  apps/
    mobile/        # the Expo app (screens, repos, stores)
    sync-worker/   # optional Cloudflare Worker + D1 cloud-sync backend
  packages/
    pos-core/      # money + pricing + profit engine (integer minor units, tested)
    database/      # SQLite schema, forward-only migrations, sync metadata
    types/         # shared domain + sync types
  docs/            # architecture, database, roadmap, screenshots
```

## Run it locally

Requires Node ≥ 22 and pnpm 10.

```bash
pnpm install
pnpm test                     # run the pos-core + database test suites

cd apps/mobile
npx expo run:android          # or: npx expo run:ios  (dev build; barcode + camera need native)
```

On first launch you'll set up your shop in two steps (name + receipt), then
you're selling.

See [docs/development.md](docs/development.md) for the full setup, and
[docs/architecture.md](docs/architecture.md) for the layering rules.

## License

MIT — see [LICENSE](LICENSE). Contributions welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md).
