# Contributing to OpenPocket POS

Thanks for helping build a POS that small merchants can actually own.

## Getting started

1. Read [docs/architecture.md](docs/architecture.md) and
   [docs/development.md](docs/development.md).
2. `pnpm install && pnpm test`.
3. Pick an issue — look for **good first issue** and **help wanted**.

## Ground rules

- **Work in vertical slices.** One module at a time: migration → repository →
  domain logic → hooks → UI → tests. Complete and verify before moving on.
- **No fake functionality.** Don't ship a screen backed by a hardcoded demo
  array or a persistence layer that doesn't exist. If something is mocked or
  deferred, mark it clearly.
- **Money is integer minor units.** Never introduce floating-point money.
  Route all money math through `@openpocket/pos-core`.
- **Business logic stays out of components.** Put it in a domain package with
  tests.
- **Schema changes need a migration.** Never edit an applied migration, never
  make users reinstall to upgrade.
- Validate inputs with Zod at trust boundaries. Use parameterized queries.

## Before you open a PR

```bash
pnpm typecheck
pnpm test
```

Add tests for any money, discount, tax, cart, payment, inventory, ledger or
profit logic, including edge cases (zero quantity, 100% discount, rounding,
insufficient payment, returns, duplicate checkout).

## Commits & PRs

Descriptive commits and PR titles. Keep changes scoped to one concern.
Reference the issue you're closing.

## Labels

`good first issue` · `help wanted` · `bug` · `feature` · `mobile` · `backend`
· `database` · `documentation` · `translation` · `printer` · `sync`

## Translations

All user-facing strings use localization keys — never hardcode UI text.
Community translations are very welcome; see `packages/localization`
(next slice) once it lands.
