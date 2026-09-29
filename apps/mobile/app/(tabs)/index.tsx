import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { asMinor } from '@openpocket/pos-core';
import { todayStats, recentlySold, listProducts, type TodayStats, type Product } from '../../src/repos';
import { useSession, useRole } from '../../src/session';
import { can } from '../../src/roles';
import { useMoney } from '../../src/pos/ui';
import { useCheckoutUI } from '../../src/checkoutUI';
import { useCart } from '../../src/cart';
import { Thumb } from '../../src/pos/Thumb';
import { useTheme, type Theme } from '../../src/theme';

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const cart = useCart();
  const money = useMoney();
  const openQuick = useCheckoutUI((s) => s.openQuick);
  const role = useRole();
  const canProducts = can(role, 'products');
  const [stats, setStats] = useState<TodayStats>({ totalSales: 0, orders: 0, itemsSold: 0 });
  const [strip, setStrip] = useState<Product[]>([]);

  useFocusEffect(useCallback(() => {
    todayStats().then(setStats);
    recentlySold(store.id).then(async (r) => {
      setStrip(r.length ? r : (await listProducts(store.id)).slice(0, 6));
    });
  }, [store.id]));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 170 }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>Welcome back</Text>
          <Text style={{ color: t.fg, fontSize: 24, fontWeight: '800' }} numberOfLines={1}>{store.name}</Text>
        </View>
        <Pressable onPress={() => router.push('/products')} style={[s.iconBtn, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Ionicons name="search-outline" size={20} color={t.fg} />
        </Pressable>
        <Pressable onPress={() => router.push('/sales')} style={[s.iconBtn, { backgroundColor: t.panel, borderColor: t.line }]}>
          <Ionicons name="time-outline" size={20} color={t.fg} />
        </Pressable>
      </View>

      {/* Today card */}
      <View style={[s.today, { backgroundColor: t.accent }]}>
        <View style={s.todayHead}>
          <Text style={{ color: t.accentFg, fontWeight: '700', fontSize: 15, opacity: 0.9 }}>Today's sales</Text>
          <Pressable onPress={() => router.push('/sales')} hitSlop={8}><Ionicons name="chevron-forward" size={18} color={t.accentFg} /></Pressable>
        </View>
        <Text style={{ color: t.accentFg, fontSize: 34, fontWeight: '800', marginTop: 4 }}>{money(asMinor(stats.totalSales))}</Text>
        <View style={s.todayStats}>
          <View style={s.todayStat}><Ionicons name="receipt-outline" size={16} color={t.accentFg} /><Text style={s.todayStatTxt}>{stats.orders} orders</Text></View>
          <View style={s.todayStat}><Ionicons name="cube-outline" size={16} color={t.accentFg} /><Text style={s.todayStatTxt}>{stats.itemsSold} items sold</Text></View>
        </View>
      </View>

      {/* Quick actions */}
      <Text style={[s.section, { color: t.fg }]}>Quick actions</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Action icon="pricetag-outline" label="Quick sale" hint="Sell without a product" onPress={openQuick} t={t} />
        {canProducts
          ? <Action icon="add-circle-outline" label="Add product" hint="New catalog item" onPress={() => router.push('/add-product')} t={t} />
          : <Action icon="barcode-outline" label="Scan & sell" hint="Scan a barcode" onPress={() => router.push('/scan')} t={t} />}
      </View>

      {/* Quick products */}
      <View style={s.sectionRow}>
        <Text style={[s.section, { color: t.fg, marginTop: 0, marginBottom: 0 }]}>Quick products</Text>
        <Pressable onPress={() => router.push('/products')}><Text style={{ color: t.accent, fontWeight: '700' }}>View all</Text></Pressable>
      </View>
      {strip.length === 0 ? (
        <Pressable onPress={() => router.push('/add-product')} style={[s.empty, { borderColor: t.line }]}>
          <Ionicons name="add-circle-outline" size={22} color={t.muted} />
          <Text style={{ color: t.muted, marginTop: 6 }}>Add your first product</Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}>
          {strip.map((p) => {
            const qty = cart.items[p.id]?.quantity ?? 0;
            const soldOut = p.stock <= qty;
            return (
              <View key={p.id} style={[s.mini, { backgroundColor: t.panel, borderColor: qty > 0 ? t.accent : t.line, boxShadow: t.shadow }]}>
                <View style={s.miniTileWrap}>
                  <Thumb uri={p.image_uri} name={p.name} style={s.miniTile} textSize={18} />
                  <Pressable onPress={() => cart.add(p)} disabled={soldOut} style={[s.plus, { backgroundColor: t.accent, opacity: soldOut ? 0.4 : 1 }]}>
                    {qty > 0 ? <Text style={{ color: t.accentFg, fontWeight: '800' }}>{qty}</Text> : <Ionicons name="add" size={18} color={t.accentFg} />}
                  </Pressable>
                </View>
                <Text style={{ color: t.fg, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ color: t.accent, fontWeight: '800', marginTop: 2 }}>{money(asMinor(p.selling_price))}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </ScrollView>
  );
}

function Action({ icon, label, hint, onPress, t }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void; t: Theme }) {
  return (
    <Pressable onPress={onPress} style={[s.action, { backgroundColor: t.panel, borderColor: t.line, boxShadow: t.shadow }]}>
      <View style={[s.actionIcon, { backgroundColor: t.accentSoft }]}><Ionicons name={icon} size={22} color={t.accent} /></View>
      <Text style={{ color: t.fg, fontWeight: '700', marginTop: 10 }}>{label}</Text>
      <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  today: { borderRadius: 20, padding: 18 },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayStats: { flexDirection: 'row', gap: 18, marginTop: 14 },
  todayStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayStatTxt: { color: '#ffffff', fontWeight: '600', opacity: 0.95 },
  section: { fontSize: 17, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  action: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16, alignItems: 'flex-start' },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 24, alignItems: 'center' },
  mini: { width: 132, borderWidth: 1, borderRadius: 18, padding: 10 },
  miniTileWrap: { position: 'relative' },
  miniTile: { width: '100%', height: 92, borderRadius: 14 },
  plus: { position: 'absolute', right: 6, bottom: 6, minWidth: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
