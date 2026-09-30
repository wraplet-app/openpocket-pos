import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { asMinor } from '@openpocket/pos-core';
import { listSales, type SaleSummary } from '../../src/repos';
import { useSession } from '../../src/session';
import { useMoney, PAYMENT_LABEL } from '../../src/pos/ui';
import { TabHeader, listProps, useTabListInset } from '../../src/pos/Screen';
import { SearchField, Chip, ChipRow, ChipDivider, EmptyState } from '../../src/pos/kit';
import { useTheme, space, radius } from '../../src/theme';

function when(ts: number): string {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.getTime() >= today.getTime() ? `Today ${time}` : `${d.toLocaleDateString()} ${time}`;
}

type Range = 'today' | '7d' | '30d' | 'all';
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
];
const METHODS: { key: string; label: string }[] = [
  { key: 'all', label: 'Any payment' },
  { key: 'cash', label: 'Cash' },
  { key: 'card', label: 'Card' },
  { key: 'bank', label: 'Transfer' },
  { key: 'credit', label: 'Credit' },
];

function sinceFor(range: Range): number | undefined {
  const d = new Date();
  if (range === 'today') { d.setHours(0, 0, 0, 0); return d.getTime(); }
  const days = RANGES.find((r) => r.key === range)?.days;
  if (days == null) return undefined;
  return Date.now() - days * 86400_000;
}

export default function Sales() {
  const t = useTheme();
  const router = useRouter();
  const listInset = useTabListInset();
  const store = useSession((s) => s.store)!; // scope sales to the current shop
  const money = useMoney();
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [range, setRange] = useState<Range>('today');
  const [method, setMethod] = useState('all');
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => {
    listSales({ storeId: store.id, since: sinceFor(range) }).then(setSales);
  }, [range, store.id]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sales.filter((x) =>
      (method === 'all' || x.payment_method === method) &&
      (!s || x.invoice_no.toLowerCase().includes(s) || (x.staff_name ?? '').toLowerCase().includes(s)));
  }, [sales, method, q]);

  const total = useMemo(() => filtered.reduce((sum, x) => sum + x.grand_total, 0), [filtered]);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? '';

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <TabHeader title="Sales" subtitle={`${rangeLabel} · ${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`}>
        <View style={s.controls}>
          <SearchField value={q} onChangeText={setQ} placeholder="Search invoice or cashier" />
          <ChipRow>
            {RANGES.map((r) => <Chip key={r.key} label={r.label} on={range === r.key} onPress={() => setRange(r.key)} />)}
            <ChipDivider />
            {METHODS.map((m) => <Chip key={m.key} label={m.label} on={method === m.key} onPress={() => setMethod(m.key)} />)}
          </ChipRow>
        </View>
      </TabHeader>

      <FlatList
        {...listProps}
        data={filtered}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: listInset, flexGrow: 1 }}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={
          <View style={[s.summary, { backgroundColor: t.accent }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.accentFg, opacity: 0.85, fontSize: 12.5 }}>{rangeLabel} total</Text>
              <Text style={{ color: t.accentFg, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                {money(asMinor(total))}
              </Text>
            </View>
            <Ionicons name="trending-up" size={28} color={t.accentFg} style={{ opacity: 0.7 }} />
          </View>
        }
        ListHeaderComponentStyle={{ marginBottom: space.md }}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No sales found" hint="Try a different period or payment filter." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/sale/${item.id}`)}
            style={({ pressed }) => [s.row, { backgroundColor: t.panel, borderColor: t.line, opacity: pressed ? 0.85 : 1 }]}>
            <View style={[s.badge, { backgroundColor: t.accentSoft }]}><Ionicons name="receipt-outline" size={20} color={t.accent} /></View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.invoice_no}</Text>
              <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                {when(item.sold_at)} · {item.item_count} item{item.item_count === 1 ? '' : 's'} · {PAYMENT_LABEL[item.payment_method] ?? item.payment_method}
              </Text>
            </View>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 16 }}>{money(asMinor(item.grand_total))}</Text>
            <Ionicons name="chevron-forward" size={18} color={t.faint} style={{ marginLeft: space.sm }} />
          </Pressable>
        )}
      />
    </View>
  );
}

const Gap = () => <View style={{ height: space.sm + 2 }} />;

const s = StyleSheet.create({
  root: { flex: 1 },
  controls: { gap: space.md, marginTop: space.xs },
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, padding: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  badge: { width: 42, height: 42, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
});
