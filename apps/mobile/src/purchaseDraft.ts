import { create } from 'zustand';

/** Shared draft for a purchase/restock so the scan screen and the new-purchase
 *  screen edit the same quantities. */
interface PurchaseDraft {
  qty: Record<string, number>;
  cost: Record<string, string>; // major-unit strings, per product
  supplierId: string | null;
  bump: (productId: string) => void;                 // +1 (used by scanner)
  setQty: (productId: string, q: number) => void;
  setCost: (productId: string, major: string) => void;
  setSupplier: (id: string | null) => void;
  ensureCost: (productId: string, major: string) => void; // set only if unset
  reset: () => void;
  count: () => number;
}

export const usePurchaseDraft = create<PurchaseDraft>((set, get) => ({
  qty: {},
  cost: {},
  supplierId: null,
  bump: (id) => set((s) => ({ qty: { ...s.qty, [id]: (s.qty[id] ?? 0) + 1 } })),
  setQty: (id, q) => set((s) => ({ qty: { ...s.qty, [id]: Math.max(0, q) } })),
  setCost: (id, major) => set((s) => ({ cost: { ...s.cost, [id]: major } })),
  setSupplier: (id) => set({ supplierId: id }),
  ensureCost: (id, major) => set((s) => (s.cost[id] === undefined ? { cost: { ...s.cost, [id]: major } } : s)),
  reset: () => set({ qty: {}, cost: {}, supplierId: null }),
  count: () => Object.values(get().qty).reduce((n, q) => n + q, 0),
}));
