import { create } from 'zustand';
import type { Product } from './repos';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  items: Record<string, CartItem>;
  add: (p: Product) => void;
  setQty: (id: string, q: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/** Ephemeral UI state only — the sale is persisted to SQLite at checkout. */
export const useCart = create<CartState>((set) => ({
  items: {},
  add: (p) =>
    set((s) => {
      const cur = s.items[p.id];
      const qty = Math.min((cur?.quantity ?? 0) + 1, p.stock);
      return { items: { ...s.items, [p.id]: { product: p, quantity: qty } } };
    }),
  setQty: (id, q) =>
    set((s) => {
      const cur = s.items[id];
      if (!cur) return s;
      const clamped = Math.max(0, Math.min(q, cur.product.stock));
      if (clamped === 0) {
        const { [id]: _drop, ...rest } = s.items;
        return { items: rest };
      }
      return { items: { ...s.items, [id]: { ...cur, quantity: clamped } } };
    }),
  remove: (id) =>
    set((s) => {
      const { [id]: _drop, ...rest } = s.items;
      return { items: rest };
    }),
  clear: () => set({ items: {} }),
}));
