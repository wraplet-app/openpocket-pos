import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listSuppliers, type Supplier } from '../src/repos';
import { useSession } from '../src/session';
import { useTheme, initials } from '../src/theme';

export default function Suppliers() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => { listSuppliers(store.id).then(setSuppliers); }, [store.id]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return suppliers;
    return suppliers.filter((c) => c.name.toLowerCase().includes(s) || (c.phone ?? '').includes(s));
  }, [suppliers, q]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 10 }}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={24} color={t.fg} /></Pressable>
        <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800' }}>Suppliers</Text>
        <Pressable onPress={() => router.push('/add-supplier')} style={[s.add, { backgroundColor: t.accent }]}>
          <Ionicons name="add" size={22} color={t.accentFg} />
        </Pressable>
      </View>

      <View style={[s.search, { backgroundColor: t.panel, borderColor: t.line }]}>
        <Ionicons name="search-outline" size={18} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search name or phone" placeholderTextColor={t.muted}
          style={{ flex: 1, marginLeft: 8, color: t.fg, fontSize: 15, paddingVertical: 0 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <View style={[s.emptyIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name="business-outline" size={28} color={t.muted} /></View>
            <Text style={{ color: t.fg, fontWeight: '700', marginTop: 14 }}>No suppliers yet</Text>
            <Text style={{ color: t.muted, marginTop: 4 }}>Add who you restock from.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.avatar, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800' }}>{initials(item.name)}</Text></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.name}</Text>
              {item.phone ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{item.phone}</Text> : null}
            </View>
          </View>
        )}
      />

      <Pressable onPress={() => router.push('/new-purchase')} style={[s.fab, { backgroundColor: t.accent, bottom: insets.bottom + 20, boxShadow: t.shadowStrong }]}>
        <Ionicons name="cart-outline" size={20} color={t.accentFg} />
        <Text style={{ color: t.accentFg, fontWeight: '800', marginLeft: 8 }}>New purchase</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 14, height: 48, borderRadius: 14, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999 },
});
