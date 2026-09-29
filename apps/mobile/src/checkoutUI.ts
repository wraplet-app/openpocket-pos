import { create } from 'zustand';
import type { Receipt } from './repos';

interface CheckoutUI {
  checkoutOpen: boolean;
  quickOpen: boolean;
  receipt: Receipt | null;
  /** Bumped after every completed sale so screens showing sales data can refresh. */
  salesVersion: number;
  openCheckout: () => void;
  closeCheckout: () => void;
  openQuick: () => void;
  closeQuick: () => void;
  showReceipt: (r: Receipt) => void;
  clearReceipt: () => void;
}

export const useCheckoutUI = create<CheckoutUI>((set) => ({
  checkoutOpen: false,
  quickOpen: false,
  receipt: null,
  salesVersion: 0,
  openCheckout: () => set({ checkoutOpen: true }),
  closeCheckout: () => set({ checkoutOpen: false }),
  openQuick: () => set({ quickOpen: true }),
  closeQuick: () => set({ quickOpen: false }),
  showReceipt: (r) => set((st) => ({ receipt: r, checkoutOpen: false, salesVersion: st.salesVersion + 1 })),
  clearReceipt: () => set({ receipt: null }),
}));
