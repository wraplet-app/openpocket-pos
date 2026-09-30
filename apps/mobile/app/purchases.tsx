import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@openpocket/pos-core';
import { listPurchases, type PurchaseSummary } from '../src/repos';
import { useSession } from '../src/session';
import { useMoney } from '../src/pos/ui';
import { Screen, IconButton, listProps } from '../src/pos/Screen';
import { EmptyState } from '../src/pos/kit';
import { useTheme, space, radius } from '../src/theme';

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
    <Screen
      title="Purchases"
      scroll={false}
      right={<IconButton icon="add" label="New purchase" filled onPress={() => router.push('/new-purchase')} />}
    >
      <FlatList
        {...listProps}
        data={purchases}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <EmptyState icon="cart-outline" title="No purchases yet" hint="Record a purchase to restock."
            action={{ label: 'New purchase', onPress: () => router.push('/new-purchase') }} />
        }
        renderItem={({ item }) => (
          <View style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.badge, { backgroundColor: t.accentSoft }]}><Ionicons name="cart-outline" size={20} color={t.accent} /></View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.reference_no}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                {when(item.purchased_at)} · {item.item_count} item{item.item_count === 1 ? '' : 's'}{item.supplier_name ? ` · ${item.supplier_name}` : ''}
              </Text>
            </View>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 16 }}>{money(asMinor(item.total))}</Text>
          </View>
        )}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  badge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
