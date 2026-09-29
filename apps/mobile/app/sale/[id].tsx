import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { roundHalfAwayFromZero, asMinor, type Minor } from '@openpocket/pos-core';
import { getSale, processReturn, type SaleDetail, type RefundMethod } from '../../src/repos';
import { useSession, useRole } from '../../src/session';
import { can } from '../../src/roles';
import { useMoney, PAYMENT_LABEL } from '../../src/pos/ui';
import { printInvoice, shareInvoicePdf, type PrintableReceipt } from '../../src/print';
import { useTheme, space, radius, type as ty } from '../../src/theme';
import { Screen, IconButton } from '../../src/pos/Screen';

const METHODS: { key: RefundMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'cash', label: 'Cash', icon: 'cash-outline' },
  { key: 'card', label: 'Card', icon: 'card-outline' },
  { key: 'bank', label: 'Transfer', icon: 'swap-horizontal-outline' },
  { key: 'account', label: 'To account', icon: 'person-outline' },
];

export default function SaleDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useSession((s) => s.store)!;
  const canReturn = can(useRole(), 'returns');
  const money = useMoney();
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<RefundMethod>('cash');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { if (id) getSale(id).then((d) => { setDetail(d); setPicks({}); }); }, [id]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const setQty = (itemId: string, q: number, max: number) =>
    setPicks((p) => ({ ...p, [itemId]: Math.max(0, Math.min(q, max)) }));

  const refundPreview = useMemo(() => {
    if (!detail) return 0;
    return detail.items.reduce((sum, it) => {
      const q = picks[it.id] ?? 0;
      if (q <= 0) return sum;
      return sum + roundHalfAwayFromZero((it.line_total * q) / it.quantity);
    }, 0);
  }, [detail, picks]);

  const anySelected = refundPreview > 0;
  const methods = detail?.header.customer_id ? METHODS : METHODS.filter((m) => m.key !== 'account');

  const submit = async () => {
    if (!detail || !anySelected || busy) return;
    setBusy(true);
    try {
      const list = Object.entries(picks).filter(([, q]) => q > 0).map(([saleItemId, quantity]) => ({ saleItemId, quantity }));
      const r = await processReturn(store.id, detail.header.id, list, method);
      Alert.alert('Return processed', `Refunded ${money(r.grandTotal)} via ${method === 'account' ? 'customer account' : method}.`);
      refresh();
    } catch (e) {
      Alert.alert('Could not process return', e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const printable = (): PrintableReceipt | null => {
    if (!detail) return null;
    const { header, items } = detail;
    const isCredit = header.payment_method === 'credit';
    return {
      invoiceNo: header.invoice_no, soldAt: header.sold_at,
      lines: items.map((i) => ({ name: i.name, quantity: i.quantity, lineTotal: i.line_total as Minor })),
      subtotal: header.subtotal as Minor, discountTotal: header.discount_total as Minor,
      taxTotal: header.tax_total as Minor, grandTotal: header.grand_total as Minor,
      paymentLabel: PAYMENT_LABEL[header.payment_method] ?? header.payment_method,
      received: isCredit ? undefined : (header.grand_total as Minor), change: isCredit ? undefined : asMinor(0),
      staffName: header.staff_name ?? undefined,
    };
  };
  const reprint = () => {
    const p = printable(); if (!p) return;
    printInvoice(store, p).catch((e) => Alert.alert('Print failed', e instanceof Error ? e.message : String(e)));
  };
  const sharePdf = () => {
    const p = printable(); if (!p) return;
    shareInvoicePdf(store, p).catch((e) => Alert.alert('Share failed', e instanceof Error ? e.message : String(e)));
  };

  if (!detail) return <Screen title="Sale"><View /></Screen>;
  const { header, items, refundedTotal } = detail;
  const fullyReturned = items.every((i) => i.quantity - i.returned <= 0);
  const showReturns = canReturn && !fullyReturned;

  const refundFooter = showReturns ? (
    <Pressable onPress={submit} disabled={!anySelected || busy}
      style={[s.primary, { backgroundColor: t.danger, opacity: !anySelected || busy ? 0.5 : 1 }]}>
      <Ionicons name="arrow-undo-outline" size={18} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>
        {busy ? 'Processing…' : anySelected ? `Refund ${money(asMinor(refundPreview))}` : 'Select items to return'}
      </Text>
    </Pressable>
  ) : undefined;

  return (
    <Screen
      title={header.invoice_no}
      subtitle={new Date(header.sold_at).toLocaleString()}
      footer={refundFooter}
      right={
        <>
          <IconButton icon="share-outline" label="Share invoice" onPress={sharePdf} />
          <IconButton icon="print-outline" label="Print invoice" onPress={reprint} />
        </>
      }
    >
      <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[ty.body, { color: t.muted }]}>Sale total</Text>
          <Text style={[ty.h1, { color: t.fg }]}>{money(asMinor(header.grand_total))}</Text>
        </View>
        {header.staff_name && (
          <View style={s.metaRow}>
            <Ionicons name="person-circle-outline" size={15} color={t.muted} />
            <Text style={[ty.small, { color: t.muted, marginLeft: 5 }]}>Sold by {header.staff_name}</Text>
          </View>
        )}
        {refundedTotal > 0 && (
          <View style={[s.refundedTag, { backgroundColor: t.warn + '22' }]}>
            <Ionicons name="arrow-undo-outline" size={14} color={t.warn} />
            <Text style={{ color: t.warn, fontWeight: '700', marginLeft: 6 }}>{money(asMinor(refundedTotal))} refunded</Text>
          </View>
        )}
      </View>

      <Text style={[ty.h2, s.section, { color: t.fg }]}>{showReturns ? 'Return items' : 'Items'}</Text>
        <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          {items.map((it, i) => {
            const remaining = it.quantity - it.returned;
            const q = picks[it.id] ?? 0;
            return (
              <View key={it.id} style={[s.item, i < items.length - 1 && { borderBottomWidth: 1, borderColor: t.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fg, fontWeight: '600' }} numberOfLines={1}>{it.name}</Text>
                  <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                    {it.quantity} × {money(asMinor(it.unit_price))}{it.returned > 0 ? ` · ${it.returned} returned` : ''}
                  </Text>
                </View>
                {showReturns && remaining > 0 ? (
                  <View style={[s.stepper, { borderColor: q > 0 ? t.accent : t.line, backgroundColor: t.surfaceAlt }]}>
                    <Pressable onPress={() => setQty(it.id, q - 1, remaining)} style={s.stepBtn} hitSlop={6}><Ionicons name="remove" size={18} color={t.fg} /></Pressable>
                    <Text style={{ color: t.fg, fontWeight: '800', minWidth: 18, textAlign: 'center' }}>{q}</Text>
                    <Pressable onPress={() => setQty(it.id, q + 1, remaining)} style={s.stepBtn} hitSlop={6}><Ionicons name="add" size={18} color={t.fg} /></Pressable>
                  </View>
                ) : remaining <= 0 ? (
                  <Text style={{ color: t.muted, fontSize: 12 }}>Returned</Text>
                ) : null}
              </View>
            );
          })}
        </View>

      {!canReturn && !fullyReturned && (
        <View style={[s.noteRow, { backgroundColor: t.accentSoft }]}>
          <Ionicons name="lock-closed-outline" size={16} color={t.muted} />
          <Text style={[ty.small, { color: t.muted, marginLeft: space.sm, flex: 1 }]}>Only managers and owners can process returns.</Text>
        </View>
      )}

      {showReturns && (
        <>
          <Text style={[ty.h2, s.section, { color: t.fg }]}>Refund method</Text>
          <View style={s.methods}>
            {methods.map((m) => {
              const on = method === m.key;
              return (
                <Pressable key={m.key} onPress={() => setMethod(m.key)}
                  style={[s.method, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel }]}>
                  <Ionicons name={m.icon} size={18} color={on ? t.accent : t.fg} />
                  <Text style={{ color: on ? t.accent : t.fg, fontWeight: '700', marginTop: 3, fontSize: 12 }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  refundedTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: space.md },
  noteRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: 14, marginTop: space.xl },
  section: { marginTop: space.xl, marginBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  stepper: { borderWidth: 1, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, paddingVertical: 3, gap: space.xs },
  stepBtn: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  methods: { flexDirection: 'row', gap: space.sm },
  method: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52 },
});
