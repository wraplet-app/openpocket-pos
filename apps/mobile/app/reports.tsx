import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, scrollProps } from '../src/pos/Screen';
import { Chip, ChipRow } from '../src/pos/kit';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@openpocket/pos-core';
import {
  reportSummary, paymentBreakdown, bestSellers, lowStockProducts, outstandingCredit,
  type ReportSummary, type PaymentSlice, type BestSeller, type LowStockItem, type OutstandingTotal,
} from '../src/repos';
import { useSession } from '../src/session';
import { useMoney, PAYMENT_LABEL } from '../src/pos/ui';
import { useTheme, space, radius, type Theme } from '../src/theme';

type Range = 'today' | 'week' | 'month';
const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
];
function since(range: Range): number {
  if (range === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  return Date.now() - (range === 'week' ? 7 : 30) * 86_400_000;
}

const PM: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  cash: { icon: 'cash-outline', color: '#12b76a' },
  card: { icon: 'card-outline', color: '#3b82f6' },
  bank: { icon: 'swap-horizontal-outline', color: '#8b5cf6' },
  credit: { icon: 'time-outline', color: '#f79009' },
};

export default function Reports() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const money = useMoney();
  const [range, setRange] = useState<Range>('today');
  const [summary, setSummary] = useState<ReportSummary>({ totalSales: 0, transactions: 0, itemsSold: 0, grossProfit: 0, discountTotal: 0 });
  const [payments, setPayments] = useState<PaymentSlice[]>([]);
  const [sellers, setSellers] = useState<BestSeller[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [credit, setCredit] = useState<OutstandingTotal>({ totalOwed: 0, customersWithBalance: 0 });

  const load = useCallback((r: Range) => {
    const s = since(r);
    reportSummary(store.id, s).then(setSummary);
    paymentBreakdown(store.id, s).then(setPayments);
    bestSellers(store.id, s).then(setSellers);
    lowStockProducts(store.id).then(setLowStock);
    outstandingCredit(store.id).then(setCredit);
  }, [store.id]);

  useFocusEffect(useCallback(() => { load(range); }, [load, range]));
  const pick = (r: Range) => { setRange(r); load(r); };

  const maxPay = Math.max(1, ...payments.map((p) => p.amount));

  return (
    <Screen title="Reports" scroll={false}>
      <View style={s.pinned}>
        <ChipRow>
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} on={range === r.key} onPress={() => pick(r.key)} />
          ))}
        </ChipRow>
      </View>

      <ScrollView {...scrollProps} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        {/* revenue hero */}
        <View style={[s.hero, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.accentFg, opacity: 0.9, fontWeight: '700' }}>Total sales</Text>
          <Text style={{ color: t.accentFg, fontSize: 34, fontWeight: '800', marginTop: 4 }}>{money(asMinor(summary.totalSales))}</Text>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="receipt-outline" size={15} color={t.accentFg} /><Text style={{ color: t.accentFg, opacity: 0.95 }}>{summary.transactions} sales</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="cube-outline" size={15} color={t.accentFg} /><Text style={{ color: t.accentFg, opacity: 0.95 }}>{summary.itemsSold} items</Text></View>
          </View>
        </View>

        {/* stat grid */}
        <View style={s.grid}>
          <Stat t={t} icon="trending-up-outline" label="Gross profit" value={money(asMinor(summary.grossProfit))} tint={t.ok} />
          <Stat t={t} icon="arrow-undo-outline" label="Refunds" value={money(asMinor(summary.refundTotal))} tint={t.danger} />
          <Stat t={t} icon="pricetag-outline" label="Discounts" value={money(asMinor(summary.discountTotal))} tint={t.warn} />
          <Stat t={t} icon="wallet-outline" label="Net sales" value={money(asMinor(summary.totalSales - summary.refundTotal))} tint={t.accent} />
        </View>

        {/* payment methods */}
        <Text style={[s.section, { color: t.fg }]}>Payment methods</Text>
        <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          {payments.length === 0 ? (
            <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 8 }}>No sales in this period.</Text>
          ) : payments.map((p) => {
            const meta = PM[p.type] ?? { icon: 'ellipse-outline' as const, color: t.muted };
            return (
              <View key={p.type} style={s.payRow}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
                <Text style={{ color: t.fg, fontWeight: '600', width: 78, marginLeft: 8 }}>{PAYMENT_LABEL[p.type] ?? p.type}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { backgroundColor: meta.color, width: `${Math.round((p.amount / maxPay) * 100)}%` }]} />
                </View>
                <Text style={{ color: t.fg, fontWeight: '700', width: 92, textAlign: 'right' }}>{money(asMinor(p.amount))}</Text>
              </View>
            );
          })}
        </View>

        {/* best sellers */}
        <Text style={[s.section, { color: t.fg }]}>Best sellers</Text>
        <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          {sellers.length === 0 ? (
            <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 8 }}>No sales in this period.</Text>
          ) : sellers.map((b, i) => (
            <View key={b.name + i} style={[s.listRow, i < sellers.length - 1 && { borderBottomWidth: 1, borderColor: t.line }]}>
              <View style={[s.rank, { backgroundColor: t.accentSoft }]}><Text style={{ color: t.accent, fontWeight: '800' }}>{i + 1}</Text></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: t.fg, fontWeight: '600' }} numberOfLines={1}>{b.name}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>{b.qty} sold</Text>
              </View>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{money(asMinor(b.revenue))}</Text>
            </View>
          ))}
        </View>

        {/* outstanding credit */}
        {credit.totalOwed > 0 && (
          <Pressable onPress={() => router.push('/customers')} style={[s.creditCard, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.rank, { backgroundColor: t.warn + '22' }]}><Ionicons name="time-outline" size={18} color={t.warn} /></View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>Outstanding credit</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>{credit.customersWithBalance} customer{credit.customersWithBalance === 1 ? '' : 's'}</Text>
            </View>
            <Text style={{ color: t.warn, fontWeight: '800' }}>{money(asMinor(credit.totalOwed))}</Text>
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          </Pressable>
        )}

        {/* low stock */}
        <Text style={[s.section, { color: t.fg }]}>Low stock</Text>
        <View style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]}>
          {lowStock.length === 0 ? (
            <Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 8 }}>Everything is well stocked. 👍</Text>
          ) : lowStock.map((p, i) => (
            <View key={p.id} style={[s.listRow, i < lowStock.length - 1 && { borderBottomWidth: 1, borderColor: t.line }]}>
              <Ionicons name="alert-circle-outline" size={20} color={p.stock <= 0 ? t.danger : t.warn} />
              <Text style={{ color: t.fg, fontWeight: '600', flex: 1, marginLeft: 10 }} numberOfLines={1}>{p.name}</Text>
              <Text style={{ color: p.stock <= 0 ? t.danger : t.warn, fontWeight: '700' }}>{p.stock <= 0 ? 'Out of stock' : `${p.stock} left`}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ t, icon, label, value, tint }: { t: Theme; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tint: string }) {
  return (
    <View style={[s.stat, { backgroundColor: t.panel, borderColor: t.line }]}>
      <View style={[s.statIcon, { backgroundColor: tint + '22' }]}><Ionicons name={icon} size={18} color={tint} /></View>
      <Text style={{ color: t.muted, fontSize: 12, marginTop: 10 }}>{label}</Text>
      <Text style={{ color: t.fg, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pinned: { padding: space.lg, paddingTop: space.md },
  hero: { borderRadius: radius.xl, padding: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  stat: { flexGrow: 1, flexBasis: '47%', borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(128,128,128,0.15)', marginHorizontal: 8, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  rank: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  creditCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: 14, marginTop: 24 },
});
