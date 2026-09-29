import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { computeCart, asMinor, asBps, type Minor } from '@openpocket/pos-core';
import { useCart } from '../cart';
import { useSession } from '../session';
import { useCheckoutUI } from '../checkoutUI';
import { useMoney } from './ui';
import { useTheme } from '../theme';

/** Floating cart bar shown across tabs. Renders nothing when the cart is empty. */
export function CartBar({ bottom }: { bottom: number }) {
  const t = useTheme();
  const cart = useCart();
  const store = useSession((s) => s.store);
  const money = useMoney();
  const openCheckout = useCheckoutUI((s) => s.openCheckout);

  const items = Object.values(cart.items);
  const count = items.reduce((n, it) => n + it.quantity, 0);
  if (count === 0 || !store) return null;

  const totals = computeCart(items.map((it) => ({ unitPrice: asMinor(it.product.selling_price), quantity: it.quantity, taxBps: asBps(it.product.tax_bps) })));

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Pressable onPress={openCheckout} style={[styles.bar, { backgroundColor: t.accent, boxShadow: t.shadowStrong }]}>
        <View style={styles.count}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 13 }}>{count}</Text></View>
        <Ionicons name="cart-outline" size={20} color={t.accentFg} />
        <Text style={{ color: t.accentFg, fontWeight: '700', flex: 1, marginLeft: 4 }}>View cart</Text>
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 18 }}>{money(totals.grandTotal)}</Text>
        <Ionicons name="chevron-forward" size={20} color={t.accentFg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 15, gap: 8 },
  count: { backgroundColor: '#fff', minWidth: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
