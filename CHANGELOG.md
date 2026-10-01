# Changelog

All notable changes to OpenPocket POS are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Camera barcode scanning on the Add Product screen, with duplicate detection
  (warns if the barcode is already in the catalog) and silent Open Food Facts
  auto-fill of name and photo.
- Marketing website at [openpocket.wraplet.app](https://openpocket.wraplet.app),
  with a Privacy Policy, Terms of Service and a Contact section.
- CI, CodeQL code-scanning and OpenSSF Scorecard workflows; Dependabot for
  dependency and GitHub Actions updates.

### Changed
- Forms keep the on-screen keyboard open while scrolling, and the Save button
  sits at the end of the form (matching the onboarding flow).

### Fixed
- Release builds no longer force-close on launch: the RevenueCat Test Store key
  is used only in development; cloud backup is open until billing is configured.

## [0.1.0] - 2026-10-01

Initial public release.

### Added
- Offline-first point of sale: product catalog, quick sale, cart and checkout
  (cash, card, transfer, store credit) with change, tax, and whole-order and
  per-line discounts.
- Barcode scan-to-sell and scan-to-restock.
- Inventory with photos, categories, SKUs, barcodes, units and per-product
  low-stock alerts.
- Customers with ledger-based store credit; credit sales and payments.
- Returns and refunds recorded as separate transactions (never editing a sale).
- Suppliers and purchases (restock updates cost and stock).
- Reports: sales, gross profit, refunds, discounts, payment-method mix, best
  sellers and low stock.
- Staff and roles (owner / manager / cashier) with 4-digit PIN sign-in and
  per-sale attribution.
- Thermal (58 / 80 mm) and A4 receipts; print and PDF share.
- CSV export/import and full JSON backup and restore.
- Optional cloud backup and multi-device sync (Cloudflare Worker + D1), billed
  at $2/month; offline selling is free forever.
- All money handled as integer minor units — never floating point.
