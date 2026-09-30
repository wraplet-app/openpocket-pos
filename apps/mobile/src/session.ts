import { create } from 'zustand';
import type { CurrencyConfig } from '@openpocket/pos-core';
import { getStore, listStores, setCurrentStore, staffCount, type Store, type Staff } from './repos';
import type { Role } from './roles';

interface SessionState {
  store: Store | null;
  stores: Store[];         // every shop on this device
  staffCount: number;      // number of active staff for the current shop
  staff: Staff | null;     // who is currently signed in (null = not yet unlocked)
  load: () => Promise<void>;
  refreshStaffCount: () => Promise<void>;
  switchStore: (id: string) => Promise<void>;
  signIn: (staff: Staff) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set, get) => ({
  store: null,
  stores: [],
  staffCount: 0,
  staff: null,
  load: async () => {
    const store = await getStore();
    const stores = await listStores();
    set({ store, stores, staffCount: store ? await staffCount(store.id) : 0 });
  },
  refreshStaffCount: async () => {
    const store = get().store;
    if (store) set({ staffCount: await staffCount(store.id) });
  },
  switchStore: async (id) => {
    if (id === get().store?.id) return;
    await setCurrentStore(id);
    set({ staff: null }); // each shop has its own staff/PINs — re-lock
    await get().load();
  },
  signIn: (staff) => set({ staff }),
  signOut: () => set({ staff: null }),
}));

/**
 * The role in effect right now. A signed-in staff uses their own role. A store
 * with no staff yet (fresh or upgraded) is treated as owner so it is never
 * locked out before anyone sets up accounts.
 */
export function useRole(): Role {
  return useSession((s) => (s.staff ? s.staff.role : 'owner'));
}

/** True when a staff PIN lock should be shown (staff exist but none signed in). */
export function useLocked(): boolean {
  return useSession((s) => s.staffCount > 0 && !s.staff);
}

export function currencyOf(store: Store): CurrencyConfig {
  return { code: store.currency_code, locale: store.currency_locale, decimals: store.currency_decimals };
}
