import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { computeCart, settlePayments, suggestCashAmounts, cashSuggestionSteps, fromMajorString, asMinor, asBps, type Minor } from '@openpocket/pos-core';
import { useCart } from '../cart';
import { useSession, currencyOf } from '../session';
import { useCheckoutUI } from '../checkoutUI';
import { checkoutSale, type PaymentMethod, type Customer } from '../repos';
import { useTheme, initials } from '../theme';
import { Thumb } from './Thumb';
import { Row, useMoney } from './ui';
import { CustomerPicker } from './CustomerPicker';
import { showAlert } from './alert';

const METHODS: { key: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'cash', label: 'Cash', icon: 'cash-outline' },
  { key: 'card', label: 'Card', icon: 'card-outline' },
  { key: 'bank', label: 'Transfer', icon: 'swap-horizontal-outline' },
  { key: 'credit', label: 'Credit', icon: 'time-outline' },
];

export function CheckoutSheet() {
  const t = useTheme();
  // Read outside the Modal: the Modal is its own window and reports no insets.
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const store = useSession((s) => s.store);
  const staff = useSession((s) => s.staff);
  const open = useCheckoutUI((s) => s.checkoutOpen);
  const close = useCheckoutUI((s) => s.closeCheckout);
  const showReceipt = useCheckoutUI((s) => s.showReceipt);

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [received, setReceived] = useState('');
  const [discountOn, setDiscountOn] = useState(false);
  const [discountPct, setDiscountPct] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const money = useMoney();

  if (!store) return null;
  const currency = currencyOf(store);
  const lines = Object.values(cart.items);

  const discountBps = Math.max(0, Math.min(10000, Math.round((parseFloat(discountPct || '0') || 0) * 100)));
  const totals = computeCart(
    lines.map((it) => ({ unitPrice: asMinor(it.product.selling_price), quantity: it.quantity, taxBps: asBps(it.product.tax_bps) })),
    discountBps > 0 ? { kind: 'percent', bps: asBps(discountBps) } : { kind: 'none' },
  );

  const isCash = method === 'cash';
  const isCredit = method === 'credit';
  const receivedMinor = (() => {
    if (!isCash) return totals.grandTotal;
    try { return received ? fromMajorString(received, currency.decimals) : asMinor(0); } catch { return asMinor(0); }
  })();
  const enough = receivedMinor >= totals.grandTotal;
  const change = enough ? ((receivedMinor - totals.grandTotal) as Minor) : asMinor(0);
  const suggestions = suggestCashAmounts(totals.grandTotal, cashSuggestionSteps(totals.grandTotal, currency.decimals)).slice(0, 5);
  const blocked = lines.length === 0 || (isCash && !enough) || (isCredit && !customer) || busy;

  const reset = () => { setReceived(''); setDiscountOn(false); setDiscountPct(''); setMethod('cash'); setCustomer(null); };
  // Reset local entry state on cancel so a discount/cash amount never carries
  // over to the next customer's checkout.
  const onClose = () => { reset(); close(); };

  // Void the whole bill: empty the cart and close. Confirmed so a busy counter
  // doesn't wipe a big order by accident.
  const cancelBill = () => {
    showAlert('Cancel this bill?', 'This removes all items from the cart.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel bill', style: 'destructive', onPress: () => { cart.clear(); reset(); close(); } },
    ]);
  };

  const confirm = async () => {
    if (blocked) return;
    setBusy(true);
    try {
      const receipt = await checkoutSale(store.id, lines, {
        paymentMethod: method, received: receivedMinor, discountBps, customerId: customer?.id ?? null, staffId: staff?.id ?? null,
      });
      cart.clear();
      reset();
      showReceipt(receipt);
    } catch { /* insufficient guard prevents this */ } finally { setBusy(false); }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.sheet, { backgroundColor: t.panel }]}>
          <View style={[s.grabber, { backgroundColor: t.line }]} />
          <View style={s.head}>
            <Text style={{ color: t.fg, fontSize: 19, fontWeight: '800' }}>Checkout</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={t.muted} /></Pressable>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* customer selector */}
          <Pressable onPress={() => setPickerOpen(true)} style={[s.customer, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
            <View style={[s.custAvatar, { backgroundColor: customer ? t.accent : t.chip }]}>
              <Ionicons name={customer ? 'person' : 'walk-outline'} size={16} color={customer ? t.accentFg : t.muted} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{customer ? customer.name : 'Walk-in customer'}</Text>
              {customer && customer.balance > 0 ? <Text style={{ color: t.danger, fontSize: 12 }}>{money(customer.balance as Minor)} due</Text> : null}
            </View>
            <Ionicons name="chevron-down" size={18} color={t.muted} />
          </Pressable>

          <View>
            {lines.map(({ product, quantity }, i) => (
              <View key={product.id} style={[s.line, { borderColor: t.line }]}>
                <Thumb uri={product.image_uri} name={product.name} style={s.tile} textSize={12} />
                <Text style={{ color: t.fg, flex: 1, marginLeft: 10 }} numberOfLines={1}>{product.name}</Text>
                <View style={s.qtyBox}>
                  <Pressable onPress={() => cart.setQty(product.id, quantity - 1)} style={[s.qBtn, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
                    <Ionicons name="remove" size={18} color={t.fg} />
                  </Pressable>
                  <Text style={{ color: t.fg, minWidth: 20, textAlign: 'center', fontWeight: '700' }}>{quantity}</Text>
                  <Pressable onPress={() => cart.setQty(product.id, quantity + 1)} style={[s.qBtn, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
                    <Ionicons name="add" size={18} color={t.fg} />
                  </Pressable>
                </View>
                <Text style={{ color: t.fg, width: 82, textAlign: 'right', fontWeight: '600' }}>{money(totals.lines[i]!.lineTotal)}</Text>
              </View>
            ))}
          </View>

          {/* summary */}
          <View style={{ marginTop: 12 }}>
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {discountOn ? (
              <View style={s.infoRow}>
                <Text style={{ color: t.muted }}>Discount %</Text>
                <TextInput value={discountPct} onChangeText={setDiscountPct} keyboardType="decimal-pad" placeholder="0"
                  placeholderTextColor={t.muted} style={{ color: t.accent, fontWeight: '700', textAlign: 'right', minWidth: 60, padding: 0 }} />
              </View>
            ) : (
              <Pressable onPress={() => setDiscountOn(true)} style={s.infoRow}>
                <Text style={{ color: t.muted }}>Discount</Text>
                <Text style={{ color: t.accent, fontWeight: '700' }}>Add ›</Text>
              </Pressable>
            )}
            {totals.discountTotal > 0 && <Row label="You save" value={`− ${money(totals.discountTotal)}`} />}
            {totals.taxTotal > 0 && <Row label="Tax" value={money(totals.taxTotal)} />}
            <View style={[s.totalRow, { borderColor: t.line }]}>
              <Text style={{ color: t.fg, fontWeight: '800', fontSize: 21 }}>Total</Text>
              <Text style={{ color: t.accent, fontWeight: '800', fontSize: 21 }}>{money(totals.grandTotal)}</Text>
            </View>
          </View>

          {/* payment method */}
          <Text style={[s.label, { color: t.muted }]}>Payment</Text>
          <View style={s.methods}>
            {METHODS.map((m) => {
              const on = method === m.key;
              return (
                <Pressable key={m.key} onPress={() => setMethod(m.key)}
                  style={[s.method, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel }]}>
                  <Ionicons name={m.icon} size={20} color={on ? t.accent : t.fg} />
                  <Text style={{ color: on ? t.accent : t.fg, fontWeight: '700', marginTop: 3 }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {isCash && (
            <>
              <Text style={[s.label, { color: t.muted }]}>Cash received</Text>
              <TextInput value={received} onChangeText={setReceived} keyboardType="decimal-pad" placeholder="0.00"
                placeholderTextColor={t.muted}
                style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.bg }]} />
              <View style={s.wrapRow}>
                {suggestions.map((amt) => (
                  <Pressable key={amt} onPress={() => setReceived((amt / 10 ** currency.decimals).toFixed(currency.decimals))}
                    style={[s.pill, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
                    <Text style={{ color: t.fg, fontWeight: '600' }}>{money(amt)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ textAlign: 'center', marginTop: 12, color: enough ? t.ok : t.danger, fontWeight: '700' }}>
                {received ? (enough ? `Change  ${money(change)}` : `Short  ${money((totals.grandTotal - receivedMinor) as Minor)}`) : ' '}
              </Text>
            </>
          )}

          {isCredit && (
            <View style={[s.creditNote, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="information-circle-outline" size={18} color={t.accent} />
              <Text style={{ color: t.fg, marginLeft: 8, flex: 1 }}>
                {customer
                  ? `Charged to ${customer.name}'s account. New balance ${money((customer.balance + totals.grandTotal) as Minor)}.`
                  : 'Select a customer to record a credit sale.'}
              </Text>
            </View>
          )}

          </ScrollView>

          <View style={[s.footer, { borderColor: t.line, paddingBottom: 12 + insets.bottom }]}>
          <Pressable onPress={confirm} disabled={blocked}
            style={[s.primary, { backgroundColor: t.accent, opacity: blocked ? 0.5 : 1 }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>
              {busy ? 'Recording…' : isCredit ? `Record credit sale · ${money(totals.grandTotal)}` : `Complete sale · ${money(totals.grandTotal)}`}
            </Text>
          </Pressable>
          <Pressable onPress={cancelBill} disabled={busy || lines.length === 0} hitSlop={8}
            style={{ alignSelf: 'center', paddingVertical: 12, marginTop: 2 }}>
            <Text style={{ color: t.danger, fontWeight: '700', fontSize: 15, opacity: busy || lines.length === 0 ? 0.4 : 1 }}>Cancel bill</Text>
          </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CustomerPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={setCustomer} />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, maxHeight: '92%' },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 20 },
  customer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 10 },
  custAvatar: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  creditNote: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginTop: 12 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  tile: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 8 },
  qBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 8, paddingTop: 10 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  methods: { flexDirection: 'row', gap: 10 },
  method: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  primary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
});
