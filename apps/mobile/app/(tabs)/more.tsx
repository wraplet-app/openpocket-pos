import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession, useRole } from '../../src/session';
import { can, ROLE_LABEL } from '../../src/roles';
import { useTheme, initials, type Theme } from '../../src/theme';

export default function More() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const me = useSession((s) => s.staff);
  const signOut = useSession((s) => s.signOut);
  const role = useRole();

  // Management links gated by the current role. Selling and sales history are
  // available to everyone; the rest need a capability.
  const allItems: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string; show: boolean }[] = [
    { icon: 'bar-chart-outline', label: 'Reports', route: '/reports', show: can(role, 'reports') },
    { icon: 'people-outline', label: 'Customers & credit', route: '/customers', show: can(role, 'customers') },
    { icon: 'business-outline', label: 'Suppliers', route: '/suppliers', show: can(role, 'suppliers') },
    { icon: 'cart-outline', label: 'Purchases / restock', route: '/purchases', show: can(role, 'purchases') },
    { icon: 'cube-outline', label: 'All products', route: '/products', show: can(role, 'products') },
    { icon: 'receipt-outline', label: 'Sales history', route: '/sales', show: true },
    { icon: 'people-circle-outline', label: 'Staff & roles', route: '/staff', show: can(role, 'staff') },
    { icon: 'cloud-outline', label: 'Cloud sync', route: '/cloud-sync', show: can(role, 'sync') },
    { icon: 'swap-vertical-outline', label: 'Backup & CSV', route: '/data', show: can(role, 'backup') },
  ];
  const manage = allItems.filter((m) => m.show);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 150 }}>
      <Text style={[s.title, { color: t.fg }]}>More</Text>

      <View style={[s.storeCard, { backgroundColor: t.panel, borderColor: t.line, boxShadow: t.shadow }]}>
        <View style={[s.avatar, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 18 }}>{initials(store.name)}</Text></View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 17 }} numberOfLines={1}>{store.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <Ionicons name="cloud-offline-outline" size={13} color={t.muted} />
            <Text style={{ color: t.muted, fontSize: 13 }}>{store.currency_code} · works offline</Text>
          </View>
        </View>
      </View>

      {me && (
        <View style={[s.userCard, { backgroundColor: t.panel, borderColor: t.line }]}>
          <View style={[s.avatar, { backgroundColor: t.accentSoft, width: 40, height: 40, borderRadius: 13 }]}>
            <Ionicons name="person" size={20} color={t.accent} />
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: t.fg, fontWeight: '700' }}>{me.name}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>Signed in · {ROLE_LABEL[me.role]}</Text>
          </View>
          <Pressable onPress={signOut} hitSlop={8} style={[s.lockBtn, { borderColor: t.line }]}>
            <Ionicons name="lock-closed-outline" size={15} color={t.fg} />
            <Text style={{ color: t.fg, fontWeight: '700', fontSize: 13, marginLeft: 5 }}>Lock</Text>
          </Pressable>
        </View>
      )}

      <Text style={[s.section, { color: t.muted }]}>MANAGE</Text>
      <Group t={t}>
        {manage.map((m, i) => (
          <Item key={m.route} t={t} icon={m.icon} label={m.label} onPress={() => router.push(m.route as never)} last={i === manage.length - 1} />
        ))}
      </Group>

      <View style={[s.tip, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="print-outline" size={16} color={t.accent} />
        <Text style={{ color: t.fg, marginLeft: 8, flex: 1, fontSize: 12 }}>
          Print or share a PDF invoice from any receipt or sale. Printing uses your phone's print service — Bluetooth, Wi-Fi and USB printers all work.
        </Text>
      </View>

      <Text style={{ color: t.faint, textAlign: 'center', marginTop: 20, fontSize: 12 }}>OpenPocket POS · v1.0 · offline-first</Text>
    </ScrollView>
  );
}

function Group({ children, t }: { children: React.ReactNode; t: Theme }) {
  return <View style={[s.group, { backgroundColor: t.panel, borderColor: t.line }]}>{children}</View>;
}

function Item({ t, icon, label, onPress, muted, last }: { t: Theme; icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; muted?: boolean; last?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.item, !last && { borderBottomWidth: 1, borderColor: t.line }]}>
      <View style={[s.itemIcon, { backgroundColor: muted ? t.surfaceAlt : t.accentSoft }]}>
        <Ionicons name={icon} size={18} color={muted ? t.muted : t.accent} />
      </View>
      <Text style={{ color: muted ? t.muted : t.fg, fontWeight: '600', flex: 1 }}>{label}</Text>
      {muted ? <Text style={{ color: t.faint, fontSize: 11, fontWeight: '700' }}>SOON</Text> : <Ionicons name="chevron-forward" size={18} color={t.faint} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  storeCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 10 },
  lockBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  avatar: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginTop: 24 },
});
