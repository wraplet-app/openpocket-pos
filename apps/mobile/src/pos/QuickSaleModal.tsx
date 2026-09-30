import { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fromMajorString } from '@openpocket/pos-core';
import { useCart } from '../cart';
import { useSession } from '../session';
import { useCheckoutUI } from '../checkoutUI';
import { newId } from '../id';
import { useTheme } from '../theme';
import type { Product } from '../repos';

/** Sell an ad-hoc item that isn't in the catalog (records product_id = NULL). */
export function QuickSaleModal() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const store = useSession((s) => s.store);
  const open = useCheckoutUI((s) => s.quickOpen);
  const close = useCheckoutUI((s) => s.closeQuick);
  const openCheckout = useCheckoutUI((s) => s.openCheckout);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [err, setErr] = useState<string | null>(null);

  if (!store) return null;

  const add = () => {
    setErr(null);
    try {
      const selling = fromMajorString(price || '0', store.currency_decimals);
      if (selling <= 0) throw new Error('Enter a price');
      const quantity = Math.max(1, Math.floor(parseFloat(qty || '1')));
      const product: Product = {
        id: `quick-${newId()}`,
        name: name.trim() || 'Quick item',
        barcode: null,
        selling_price: selling,
        cost_price: 0,
        tax_bps: 0,
        stock: Number.MAX_SAFE_INTEGER,
        isQuick: true,
      };
      cart.add(product);
      if (quantity > 1) cart.setQty(product.id, quantity);
      setName(''); setPrice(''); setQty('1');
      close();
      openCheckout();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.sheet, { backgroundColor: t.panel, paddingBottom: 20 + insets.bottom }]}>
          <View style={[s.grabber, { backgroundColor: t.line }]} />
          <View style={s.head}>
            <Text style={{ color: t.fg, fontSize: 19, fontWeight: '800' }}>Quick sale</Text>
            <Pressable onPress={close} hitSlop={10}><Ionicons name="close" size={24} color={t.muted} /></Pressable>
          </View>

          <Text style={[s.label, { color: t.muted }]}>DESCRIPTION (OPTIONAL)</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Miscellaneous" placeholderTextColor={t.muted}
            style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]} />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 2 }}>
              <Text style={[s.label, { color: t.muted }]}>PRICE ({store.currency_code})</Text>
              <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={t.muted}
                style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: t.muted }]}>QTY</Text>
              <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="1" placeholderTextColor={t.muted}
                style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]} />
            </View>
          </View>

          {err && <Text style={{ color: t.danger, marginTop: 12 }}>{err}</Text>}

          <Pressable onPress={add} style={[s.primary, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>Add to cart</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10, paddingBottom: 32 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18 },
  primary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
});
