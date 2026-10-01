/**
 * Cloud-sync subscription gate, powered by direct store billing (expo-iap /
 * OpenIAP — Google Play Billing + StoreKit). Offline selling is free forever;
 * the $2/month plan unlocks the *online* feature (cloud backup + sync).
 *
 * Billing needs the native module, so it only works in a dev/production build
 * (`npx expo prebuild` + a real build). In Expo Go, on web, or any build
 * without the module, `billingAvailable()` is false and the app degrades
 * gracefully: cloud sync is open to everyone rather than hard-paywalled, and
 * the paywall offers a dev unlock for testing.
 *
 * The product is a Google Play subscription with SKU `cloud_sync_monthly`
 * (base plan `monthly`). Configure a matching App Store subscription with the
 * same product id for iOS.
 */
import { useCallback, useEffect, useState } from 'react';

/** Google Play / App Store product id for the $2/mo cloud-sync subscription. */
export const CLOUD_SYNC_SKU = 'cloud_sync_monthly';

// Native module is loaded lazily and defensively: a build without expo-iap
// (Expo Go, web, or a build that didn't prebuild) just reports "unavailable".
let IAP: any = null;
let triedLoad = false;
let connecting: Promise<boolean> | null = null;
let connected = false;
let devUnlocked = false;

function iap(): any {
  if (triedLoad) return IAP;
  triedLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    IAP = require('expo-iap');
  } catch { IAP = null; }
  return IAP;
}

export function billingAvailable(): boolean {
  const m = iap();
  return !!m && typeof m.initConnection === 'function';
}

/** Open the store connection once; shared across concurrent callers. */
async function connect(): Promise<boolean> {
  if (connected) return true;
  if (!billingAvailable()) return false;
  if (!connecting) {
    connecting = iap()
      .initConnection()
      .then((ok: boolean) => { connected = ok !== false; return connected; })
      .catch(() => false);
  }
  const ok = await connecting;
  if (!ok) connecting = null; // let a later call retry
  return ok;
}

function isUserCancel(err: any, m: any): boolean {
  const code = err?.code;
  return code === 'user-cancelled' || (m?.ErrorCode && code === m.ErrorCode.UserCancelled);
}

/** True if the current user may use cloud sync (active subscription or dev unlock). */
export async function hasCloudSync(): Promise<boolean> {
  if (devUnlocked) return true;
  // Billing unavailable (Expo Go / web / un-prebuilt build) → cloud backup is
  // open to everyone rather than paywalled. Can't reach the store → same: don't
  // lock a paying user out just because the connection failed.
  if (!billingAvailable()) return true;
  if (!(await connect())) return true;
  try {
    return await iap().hasActiveSubscriptions([CLOUD_SYNC_SKU]);
  } catch { return false; }
}

export interface Plan { id: string; priceString: string; period: string; pkg: unknown }

/** The monthly cloud-sync plan from the store. `pkg` carries the store product. */
export async function getMonthlyPlan(): Promise<Plan | null> {
  if (!billingAvailable()) return null;
  if (!(await connect())) return null;
  try {
    const products = await iap().fetchProducts({ skus: [CLOUD_SYNC_SKU], type: 'subs' });
    const product = Array.isArray(products)
      ? (products.find((p: any) => p?.id === CLOUD_SYNC_SKU) ?? products[0])
      : null;
    if (!product) return null;
    // Android prices live on the per-offer pricing; iOS prices the product.
    const priceString = product.subscriptionOffers?.[0]?.displayPrice ?? product.displayPrice ?? '$2.00';
    return { id: product.id, priceString, period: 'month', pkg: product };
  } catch { return null; }
}

/**
 * Buy the plan. Resolves true once the purchase lands (store billing is
 * event-based, so we bridge the one-shot listeners into a promise), false on a
 * non-cancel failure, and throws `{ userCancelled: true }` when the user backs
 * out — the paywall distinguishes those.
 */
export async function purchaseMonthly(plan: Plan): Promise<boolean> {
  if (!billingAvailable()) return false;
  if (!(await connect())) return false;
  const m = iap();
  const product: any = plan.pkg;
  const offerToken: string | undefined = product?.subscriptionOffers?.[0]?.offerTokenAndroid ?? undefined;

  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    let updateSub: any;
    let errorSub: any;
    const cleanup = () => {
      try { updateSub?.remove?.(); } catch { /* noop */ }
      try { errorSub?.remove?.(); } catch { /* noop */ }
    };
    const fail = (err: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (isUserCancel(err, m)) { reject(Object.assign(new Error('Purchase cancelled'), { userCancelled: true })); return; }
      resolve(false);
    };

    updateSub = m.purchaseUpdatedListener(async (purchase: any) => {
      if (settled) return;
      const pid = purchase?.productId ?? purchase?.id;
      if (pid && pid !== CLOUD_SYNC_SKU) return; // not our product
      settled = true;
      // Acknowledge/finalize — Android auto-refunds unacknowledged purchases
      // within 3 days. Subscriptions are non-consumable. A failed ack still
      // leaves the sub active; the entitlement check confirms it either way.
      try { await m.finishTransaction({ purchase, isConsumable: false }); } catch { /* noop */ }
      cleanup();
      resolve(true);
    });
    errorSub = m.purchaseErrorListener((err: any) => fail(err));

    const request = {
      apple: { sku: CLOUD_SYNC_SKU },
      google: {
        skus: [CLOUD_SYNC_SKU],
        ...(offerToken ? { subscriptionOffers: [{ sku: CLOUD_SYNC_SKU, offerToken }] } : {}),
      },
    };
    Promise.resolve(m.requestPurchase({ request, type: 'subs' })).catch(fail);
  });
}

/** Restore a subscription bought on another device / after reinstall. */
export async function restorePurchases(): Promise<boolean> {
  if (!billingAvailable()) return false;
  if (!(await connect())) return false;
  try { await iap().restorePurchases(); } catch { /* fall through to the entitlement check */ }
  try {
    return await iap().hasActiveSubscriptions([CLOUD_SYNC_SKU]);
  } catch { return false; }
}

/** Dev-only: unlock cloud sync without a real purchase (for testing the flow). */
export function devUnlock(): void { devUnlocked = true; }

/** Hook: the live cloud-sync entitlement, with a refresh(). */
export function useCloudEntitlement(): { active: boolean; loading: boolean; refresh: () => void } {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    setLoading(true);
    hasCloudSync().then((a) => { setActive(a); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { active, loading, refresh };
}
