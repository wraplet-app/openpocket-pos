# Development setup

## Prerequisites

- Node ≥ 22 (developed on Node 26)
- pnpm 10 (`corepack enable` then `corepack use pnpm@10`)

## Install & test

```bash
pnpm install
pnpm test        # every package
pnpm typecheck   # tsc across packages (needs the typescript devDependency)
```

Run a single package's tests directly — no build, no test framework, just
Node's built-in runner and type-stripping:

```bash
cd packages/pos-core && node --test
```

## Why there's no build step (yet)

The core packages export their `.ts` sources directly and are consumed two
ways, both of which compile on the fly:

- **Node** (tests, tooling) strips types natively — that is why relative
  imports use explicit `.ts` extensions.
- **Metro** (the Expo app, next slice) transpiles TypeScript already.

A `tsc`/`tsup` build is only added when we publish packages to npm, which we
don't for an app-internal monorepo. Add it then, not now.

## Conventions

- Strict TypeScript, no `any`, small pure functions, explicit error handling.
- Business logic lives in domain packages, never in UI components.
- Every business-critical change ships with a runnable test.
- Money never touches a float — use `pos-core` helpers.
- New DB schema = new migration file; never edit an applied one.

## Layout for a new vertical slice

```
packages/<domain>/src/...      # pure domain logic + tests
apps/mobile/services/...       # orchestration (transactions, repos)
apps/mobile/hooks/...          # React bindings
apps/mobile/app/...            # Expo Router screens
```
