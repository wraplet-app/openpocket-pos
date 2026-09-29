import { create } from 'zustand';
import type { Receipt } from './repos';

interface CheckoutUI {
  checkoutOpen: boolean;
  quickOpen: boolean;
  receipt: Receipt | null;
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
  openCheckout: () => set({ checkoutOpen: true }),
  closeCheckout: () => set({ checkoutOpen: false }),
  openQuick: () => set({ quickOpen: true }),
  closeQuick: () => set({ quickOpen: false }),
  showReceipt: (r) => set({ receipt: r, checkoutOpen: false }),
  clearReceipt: () => set({ receipt: null }),
}));
