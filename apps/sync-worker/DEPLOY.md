# Deploy the OpenPocket sync backend

One hosted Cloudflare Worker + D1 database serves **every** shop. Each shop is
isolated by its own sync token (the "shop code"), so you deploy this once and
all your users get one-tap cloud backup.

You run these commands yourself — your Cloudflare credentials never leave your
machine. Takes about 5 minutes.

## Prerequisites

- A Cloudflare account (free plan is fine — Workers + D1 have a free tier).
- Node and pnpm installed, and this repo checked out.

## Steps

```bash
cd apps/sync-worker

# 1. Sign in to Cloudflare (opens your browser to authorize).
npx wrangler login

# 2. Create the D1 database. This prints a "database_id = ..." line.
pnpm db:create
```

**3. Paste the printed `database_id`** into [`wrangler.toml`](./wrangler.toml),
replacing `REPLACE_WITH_D1_DATABASE_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "openpocket-production"
database_id = "the-id-that-was-printed"
```

```bash
# 4. Create the tables in the remote database.
pnpm db:schema

# 5. Deploy the Worker. This prints your live URL, e.g.
#    https://openpocket-sync.<your-subdomain>.workers.dev
pnpm deploy
```

**6. Wire the app to it.** Open
[`apps/mobile/src/sync.ts`](../../apps/mobile/src/sync.ts) and paste your live
URL into `DEFAULT_SYNC_URL`:

```ts
export const DEFAULT_SYNC_URL = 'https://openpocket-sync.<your-subdomain>.workers.dev';
```

That's it. The app's **Cloud backup** screen now shows one-tap "Turn on cloud
backup" — no URL or token for users to type. Rebuild the app to pick up the URL.

## Verify

```bash
curl https://openpocket-sync.<your-subdomain>.workers.dev/health
# -> {"ok":true,"service":"openpocket-sync","tables":N}
```

## Before the public launch (not needed for your own device test)

Right now any device that knows a shop code can sync — access is gated only by
the app's paywall, not the server. Before opening sync to the public, add
**server-side entitlement verification** so non-subscribers can't use the
backend for free:

1. In `src/index.ts`, on `/sync/register` and `/sync/push`, verify the device's
   subscription with the **Google Play Developer API**
   (`purchases.subscriptionsv2.get`) — and the equivalent App Store Server API
   on iOS — and confirm the `cloud_sync_monthly` subscription is active before
   binding/writing.
2. Store the Google service-account credentials (and App Store issuer key) as
   Worker secrets, e.g. `npx wrangler secret put PLAY_SERVICE_ACCOUNT_JSON`.
3. Send the store purchase token from the device alongside the shop token.

This pairs with hardening the shop code to `expo-crypto` random bytes (see the
`ponytail` note in `apps/mobile/src/sync.ts`).
