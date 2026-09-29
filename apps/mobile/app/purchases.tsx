import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@openpocket/pos-core';
import { listPurchases, type PurchaseSummary } from '../src/repos';
import { useSession } from '../src/session';
import { useMoney } from '../src/pos/ui';
import { useTheme } from '../src/theme';

function when(ts: number): string {
  const d = new Date(ts); const today = new Date(); today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.getTime() >= today.getTime() ? `Today ${time}` : `${d.toLocaleDateString()} ${time}`;
}

export default function Purchases() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const money = useMoney();
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);

  useFocusEffect(useCallback(() => { listPurchases(store.id).then(setPurchases); }, [store.id]));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 10 }}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={24} color={t.fg} /></Pressable>
        <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800' }}>Purchases</Text>
        <Pressable onPress={() => router.push('/new-purchase')} style={[s.add, { backgroundColor: t.accent }]}>
          <Ionicons name="add" size={22} color={t.accentFg} />
        </Pressable>
      </View>

      <FlatList
        data={purchases}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <View style={[s.emptyIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name="cart-outline" size={28} color={t.muted} /></View>
            <Text style={{ color: t.fg, fontWeight: '700', marginTop: 14 }}>No purchases yet</Text>
            <Text style={{ color: t.muted, marginTop: 4, marginBottom: 20 }}>Record a purchase to restock.</Text>
            <Pressable onPress={() => router.push('/new-purchase')} style={[s.primary, { backgroundColor: t.accent }]}>
              <Ionicons name="add" size={18} color={t.accentFg} />
              <Text style={{ color: t.accentFg, fontWeight: '800', marginLeft: 6 }}>New purchase</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.badge, { backgroundColor: t.accentSoft }]}><Ionicons name="cart-outline" size={20} color={t.accent} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.reference_no}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                {when(item.purchased_at)} · {item.item_count} item{item.item_count === 1 ? '' : 's'}{item.supplier_name ? ` · ${item.supplier_name}` : ''}
              </Text>
            </View>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 16 }}>{money(asMinor(item.total))}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12 },
  badge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 26 },
});
