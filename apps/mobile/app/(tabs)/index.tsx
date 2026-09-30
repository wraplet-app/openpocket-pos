import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { asMinor } from '@openpocket/pos-core';
import {
  todayStats, recentlySold, listProducts, lowStockProducts,
  type TodayStats, type Product, type LowStockItem,
} from '../../src/repos';
import { useSession, useRole } from '../../src/session';
import { can } from '../../src/roles';
import { useMoney } from '../../src/pos/ui';
import { useCheckoutUI } from '../../src/checkoutUI';
import { useCart } from '../../src/cart';
import { Thumb } from '../../src/pos/Thumb';
import { TabHeader, IconButton, scrollProps, useTabListInset } from '../../src/pos/Screen';
import { useTheme, space, radius, type as ty, type Theme } from '../../src/theme';

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const listInset = useTabListInset();
  const store = useSession((s) => s.store)!;
  const cart = useCart();
  const money = useMoney();
  const openQuick = useCheckoutUI((s) => s.openQuick);
  const salesVersion = useCheckoutUI((s) => s.salesVersion);
  const role = useRole();
  const canProducts = can(role, 'products');
  const [stats, setStats] = useState<TodayStats>({ totalSales: 0, orders: 0, itemsSold: 0 });
  const [strip, setStrip] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<LowStockItem[]>([]);

  useFocusEffect(useCallback(() => {
    todayStats(store.id).then(setStats);
    recentlySold(store.id).then(async (r) => {
      setStrip(r.length ? r : (await listProducts(store.id)).slice(0, 8));
    });
    lowStockProducts(store.id, 50).then(setAlerts);
  }, [store.id, salesVersion]));

  const outCount = alerts.filter((a) => a.stock <= 0).length;
  const lowCount = alerts.length - outCount;

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <TabHeader
        title={store.name}
        subtitle="Welcome back"
        right={
          <>
            <IconButton icon="search-outline" label="Search products" onPress={() => router.push('/products')} />
            <IconButton icon="scan-outline" label="Scan barcode" onPress={() => router.push('/scan')} />
          </>
        }
      />
      <ScrollView {...scrollProps} style={s.flex} contentContainerStyle={{ padding: space.lg, paddingBottom: listInset }}>
        {/* Today */}
        <Pressable onPress={() => router.push('/sales')} style={[s.today, { backgroundColor: t.accent }]} accessibilityLabel="Today's sales">
          <View style={s.todayHead}>
            <Text style={{ color: t.accentFg, fontWeight: '700', fontSize: 14, opacity: 0.9 }}>Today's sales</Text>
            <Ionicons name="chevron-forward" size={18} color={t.accentFg} />
          </View>
          <Text style={{ color: t.accentFg, fontSize: 34, lineHeight: 42, fontWeight: '800', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
            {money(asMinor(stats.totalSales))}
          </Text>
          <View style={s.todayStats}>
            <View style={s.todayStat}><Ionicons name="receipt-outline" size={16} color={t.accentFg} /><Text style={s.todayStatTxt}>{stats.orders} {stats.orders === 1 ? 'order' : 'orders'}</Text></View>
            <View style={s.todayStat}><Ionicons name="cube-outline" size={16} color={t.accentFg} /><Text style={s.todayStatTxt}>{stats.itemsSold} items sold</Text></View>
          </View>
        </Pressable>

        {/* Stock alerts */}
        {alerts.length > 0 && canProducts && (
          <Pressable onPress={() => router.push('/products')} style={[s.alert, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.alertIcon, { backgroundColor: outCount ? '#fdecec' : '#fff3e0' }]}>
              <Ionicons name="alert-circle-outline" size={20} color={outCount ? t.danger : t.warn} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>Needs attention</Text>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 1 }}>
                {[outCount ? `${outCount} out of stock` : null, lowCount ? `${lowCount} running low` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.faint} />
          </Pressable>
        )}

        {/* Quick actions */}
        <Text style={[s.section, { color: t.fg }]}>Quick actions</Text>
        <View style={s.actions}>
          <Action icon="pricetag-outline" label="Quick sale" hint="Sell without a product" onPress={openQuick} t={t} />
          {canProducts
            ? <Action icon="add-circle-outline" label="Add product" hint="New catalog item" onPress={() => router.push('/add-product')} t={t} />
            : <Action icon="barcode-outline" label="Scan & sell" hint="Scan a barcode" onPress={() => router.push('/scan')} t={t} />}
        </View>

        {/* Quick products */}
        <View style={s.sectionRow}>
          <Text style={[s.sectionText, { color: t.fg }]}>Quick products</Text>
          <Pressable onPress={() => router.push('/products')} hitSlop={8}><Text style={{ color: t.accent, fontWeight: '700' }}>View all</Text></Pressable>
        </View>
        {strip.length === 0 ? (
          <Pressable onPress={() => router.push('/add-product')} style={[s.empty, { borderColor: t.line }]}>
            <Ionicons name="add-circle-outline" size={22} color={t.muted} />
            <Text style={{ color: t.muted, marginTop: 6 }}>Add your first product</Text>
          </Pressable>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.stripScroll} contentContainerStyle={s.strip}>
            {strip.map((p) => {
              const qty = cart.items[p.id]?.quantity ?? 0;
              const soldOut = p.stock <= qty;
              return (
                <View key={p.id} style={[s.mini, { backgroundColor: t.panel, borderColor: qty > 0 ? t.accent : t.line }]}>
                  <View style={[s.miniTileWrap, { borderColor: t.line }]}>
                    <Thumb uri={p.image_uri} name={p.name} style={s.miniTile} textSize={18} />
                    <Pressable onPress={() => cart.add(p)} disabled={soldOut} accessibilityLabel={`Add ${p.name}`}
                      style={[s.plus, { backgroundColor: t.accent, opacity: soldOut ? 0.4 : 1 }]}>
                      {qty > 0 ? <Text style={{ color: t.accentFg, fontWeight: '800' }}>{qty}</Text> : <Ionicons name="add" size={18} color={t.accentFg} />}
                    </Pressable>
                  </View>
                  <Text style={{ color: t.fg, fontWeight: '600', marginTop: space.sm, fontSize: 13.5 }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: t.accent, fontWeight: '800', marginTop: 2 }}>{money(asMinor(p.selling_price))}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

function Action({ icon, label, hint, onPress, t }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void; t: Theme }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.action, { backgroundColor: t.panel, borderColor: t.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[s.actionIcon, { backgroundColor: t.accentSoft }]}><Ionicons name={icon} size={22} color={t.accent} /></View>
      <Text style={{ color: t.fg, fontWeight: '700', marginTop: space.md }}>{label}</Text>
      <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>{hint}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  today: { borderRadius: radius.xl, padding: space.xl },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayStats: { flexDirection: 'row', gap: space.xl, marginTop: space.md },
  todayStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayStatTxt: { color: '#ffffff', fontWeight: '600', opacity: 0.95 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  alertIcon: { width: 40, height: 40, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
  section: { ...ty.h1, marginTop: space.xxl, marginBottom: space.md },
  sectionText: { ...ty.h1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xxl, marginBottom: space.md },
  actions: { flexDirection: 'row', gap: space.md },
  action: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, alignItems: 'flex-start' },
  actionIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, padding: space.xxl, alignItems: 'center' },
  stripScroll: { marginHorizontal: -space.lg, flexGrow: 0 },
  strip: { gap: space.md, paddingHorizontal: space.lg, paddingVertical: 2 },
  mini: { width: 136, borderWidth: 1, borderRadius: radius.lg, padding: 10 },
  miniTileWrap: { position: 'relative', borderRadius: radius.md - 2, borderWidth: StyleSheet.hairlineWidth, backgroundColor: '#fff', overflow: 'hidden' },
  miniTile: { width: '100%', height: 96 },
  plus: { position: 'absolute', right: 6, bottom: 6, minWidth: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
