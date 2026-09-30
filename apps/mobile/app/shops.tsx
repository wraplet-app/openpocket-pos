import { View, Text, Pressable, Image, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../src/session';
import { useTheme, initials, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';

export default function Shops() {
  const t = useTheme();
  const router = useRouter();
  const stores = useSession((s) => s.stores);
  const current = useSession((s) => s.store);
  const me = useSession((s) => s.staff);
  const switchStore = useSession((s) => s.switchStore);
  const signOut = useSession((s) => s.signOut);

  const pick = async (id: string) => {
    if (id === current?.id) { router.back(); return; }
    await switchStore(id);
    router.replace('/'); // re-locks; the new shop's PIN screen (if any) shows
  };

  const logout = () => {
    if (!me) { Alert.alert('Not signed in', 'Add staff with PINs to enable sign-in.'); return; }
    Alert.alert('Log out?', `Sign ${me.name} out. Anyone will need a PIN to use this shop again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => { signOut(); router.replace('/'); } },
    ]);
  };

  return (
    <Screen title="Shops" subtitle="Switch between shops on this device">
      {stores.map((shop) => {
        const on = shop.id === current?.id;
        return (
          <Pressable key={shop.id} onPress={() => pick(shop.id)}
            style={[s.row, { backgroundColor: t.panel, borderColor: on ? t.accent : t.line }]}>
            {shop.logo_uri
              ? <Image source={{ uri: shop.logo_uri }} style={[s.logo, { borderColor: t.line }]} resizeMode="contain" />
              : <View style={[s.logo, { backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: t.accentFg, fontWeight: '800' }}>{initials(shop.name)}</Text></View>}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }} numberOfLines={1}>{shop.name}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{shop.currency_code}{shop.tagline ? ` · ${shop.tagline}` : ''}</Text>
            </View>
            {on
              ? <View style={[s.badge, { backgroundColor: t.accentSoft }]}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 12 }}>Current</Text></View>
              : <Ionicons name="chevron-forward" size={18} color={t.muted} />}
          </Pressable>
        );
      })}

      <Pressable onPress={() => router.push('/new-shop')} style={[s.add, { borderColor: t.accent }]}>
        <Ionicons name="add-circle-outline" size={20} color={t.accent} />
        <Text style={{ color: t.accent, fontWeight: '800', marginLeft: 8 }}>Add a shop</Text>
      </Pressable>

      {me && (
        <Pressable onPress={logout} style={[s.logout, { borderColor: t.line }]}>
          <Ionicons name="log-out-outline" size={18} color={t.danger} />
          <Text style={{ color: t.danger, fontWeight: '700', marginLeft: 8 }}>Log out ({me.name})</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm },
  logo: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, paddingVertical: 14, marginTop: space.sm },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: radius.lg, paddingVertical: 14, marginTop: space.xxl },
});
