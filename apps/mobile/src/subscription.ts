/**
 * Cloud-sync subscription gate, powered by RevenueCat. Offline selling is free
 * forever; the $2/month plan unlocks the *online* feature (cloud backup + sync).
 *
 * This module is inert until you (1) `npx expo install react-native-purchases`,
 * (2) rebuild the app, and (3) set REVENUECAT_ANDROID_KEY below (from your
 * RevenueCat project) with a matching entitlement + a $2/mo product configured
 * in RevenueCat + Google Play. Until then `billingAvailable()` is false and the
 * paywall shows a "set up billing" state (with a dev unlock for testing).
 *
 * See HANDOFF.md § "Subscription (RevenueCat)" for the full setup.
 */
import { useCallback, useEffect, useState } from 'react';

/**
 * RevenueCat public SDK key. This is the "Test Store" key for the OpenPocket POS
 * RevenueCat project (sandbox — safe to ship; public SDK keys are meant to live
 * in client apps). It exercises the full purchase flow without Google Play.
 * For production, add a Google Play app in RevenueCat and swap in its `goog_…`
 * key. Empty = billing not configured.
 */
// Production key (goog_…) — paste it here once Google Play billing + the $2/mo
// product are live in RevenueCat. Empty until then.
const REVENUECAT_PROD_KEY = '';
// The RevenueCat SDK *force-closes* a release build that configures with a Test
// Store key, so the test key is used only in development. Release builds use the
// production key (empty until Play billing is set up) → billing is simply
// "not configured", and the app degrades gracefully instead of crashing.
export const REVENUECAT_ANDROID_KEY = __DEV__ ? 'test_hZCCFmXpUXkxAFUBYkPwtivzYtF' : REVENUECAT_PROD_KEY;
/** The RevenueCat entitlement (identifier) that unlocks cloud sync. */
export const CLOUD_ENTITLEMENT = 'cloud';

// The native module is loaded lazily and defensively: a build without
// react-native-purchases (or a dev reload) just reports "unavailable".
let RC: any = null;
let triedLoad = false;
let configured = false;
let devUnlocked = false;

function rc(): any {
  if (triedLoad) return RC;
  triedLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-purchases');
    RC = mod?.default ?? mod;
  } catch { RC = null; }
  return RC;
}

export function billingAvailable(): boolean {
  return REVENUECAT_ANDROID_KEY.length > 0 && !!rc();
}

async function configure(): Promise<void> {
  if (configured || !billingAvailable()) return;
  try { rc().configure({ apiKey: REVENUECAT_ANDROID_KEY }); configured = true; } catch { /* leave unconfigured */ }
}

/** True if the current user may use cloud sync (active subscription or dev unlock). */
export async function hasCloudSync(): Promise<boolean> {
  if (devUnlocked) return true;
  // Billing not configured (e.g. a release build before Google Play billing is
  // live): cloud backup is open to everyone rather than paywalled. Once a real
  // key is set, the entitlement below is enforced.
  if (!billingAvailable()) return true;
  await configure();
  try {
    const info = await rc().getCustomerInfo();
    return !!info?.entitlements?.active?.[CLOUD_ENTITLEMENT];
  } catch { return false; }
}

export interface Plan { id: string; priceString: string; period: string; pkg: unknown }

/** The monthly cloud-sync plan from RevenueCat's current offering. */
export async function getMonthlyPlan(): Promise<Plan | null> {
  if (!billingAvailable()) return null;
  await configure();
  try {
    const offerings = await rc().getOfferings();
    const pkg = offerings?.current?.monthly ?? offerings?.current?.availablePackages?.[0];
    if (!pkg) return null;
    return { id: pkg.identifier, priceString: pkg.product?.priceString ?? '$2.00', period: 'month', pkg };
  } catch { return null; }
}

/** Buy the plan. Returns true when the entitlement is active afterward. */
export async function purchaseMonthly(plan: Plan): Promise<boolean> {
  if (!billingAvailable()) return false;
  const res = await rc().purchasePackage(plan.pkg);
  return !!res?.customerInfo?.entitlements?.active?.[CLOUD_ENTITLEMENT];
}

/** Restore a subscription bought on another device / after reinstall. */
export async function restorePurchases(): Promise<boolean> {
  if (!billingAvailable()) return false;
  try {
    const info = await rc().restorePurchases();
    return !!info?.entitlements?.active?.[CLOUD_ENTITLEMENT];
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
