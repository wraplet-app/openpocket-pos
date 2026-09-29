import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { asMinor } from '@openpocket/pos-core';
import { listSales, type SaleSummary } from '../../src/repos';
import { useSession } from '../../src/session';
import { useMoney, PAYMENT_LABEL } from '../../src/pos/ui';
import { useTheme } from '../../src/theme';

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
  { key: 'all', label: 'All', days: null },
];
const METHODS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const money = useMoney();
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [range, setRange] = useState<Range>('today');
  const [method, setMethod] = useState('all');
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => {
    listSales({ since: sinceFor(range) }).then(setSales);
  }, [range]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sales.filter((x) =>
      (method === 'all' || x.payment_method === method) &&
      (!s || x.invoice_no.toLowerCase().includes(s) || (x.staff_name ?? '').toLowerCase().includes(s)));
  }, [sales, method, q]);

  const total = useMemo(() => filtered.reduce((sum, x) => sum + x.grand_total, 0), [filtered]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8 }}>
      <Text style={[s.title, { color: t.fg }]}>Sales</Text>

      <View style={[s.summary, { backgroundColor: t.accent }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.accentFg, opacity: 0.85, fontSize: 12 }}>{RANGES.find((r) => r.key === range)?.label} total</Text>
          <Text style={{ color: t.accentFg, fontSize: 24, fontWeight: '800', marginTop: 2 }}>{money(asMinor(total))}</Text>
        </View>
        <Text style={{ color: t.accentFg, opacity: 0.85, fontSize: 12 }}>{filtered.length} order{filtered.length === 1 ? '' : 's'}</Text>
      </View>

      <View style={[s.search, { backgroundColor: t.panel, borderColor: t.line }]}>
        <Ionicons name="search-outline" size={18} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search invoice or cashier" placeholderTextColor={t.muted}
          style={{ flex: 1, marginLeft: 8, color: t.fg, fontSize: 15, paddingVertical: 0 }} />
      </View>

      <ChipRow items={RANGES.map((r) => ({ key: r.key, label: r.label }))} value={range} onPick={(k) => setRange(k as Range)} t={t} />
      <ChipRow items={METHODS} value={method} onPick={setMethod} t={t} muted />

      <FlatList
        data={filtered}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 160 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 40 }}>No sales match.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/sale/${item.id}`)} style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.badge, { backgroundColor: t.accentSoft }]}><Ionicons name="receipt-outline" size={20} color={t.accent} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.invoice_no}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                {when(item.sold_at)} · {item.item_count} item{item.item_count === 1 ? '' : 's'} · {PAYMENT_LABEL[item.payment_method] ?? item.payment_method}
              </Text>
            </View>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 16 }}>{money(asMinor(item.grand_total))}</Text>
            <Ionicons name="chevron-forward" size={18} color={t.muted} style={{ marginLeft: 8 }} />
          </Pressable>
        )}
      />
    </View>
  );
}

function ChipRow({ items, value, onPick, t, muted }: {
  items: { key: string; label: string }[]; value: string; onPick: (k: string) => void; t: ReturnType<typeof useTheme>; muted?: boolean;
}) {
  return (
    <View style={s.chips}>
      {items.map((it) => {
        const on = value === it.key;
        return (
          <Pressable key={it.key} onPress={() => onPick(it.key)}
            style={[s.chip, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : (muted ? 'transparent' : t.panel) }]}>
            <Text style={{ color: on ? t.accent : t.muted, fontWeight: '600', fontSize: 13 }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', paddingHorizontal: 16, marginBottom: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 16, padding: 16 },
  search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, height: 46, borderRadius: 14, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12 },
  badge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
