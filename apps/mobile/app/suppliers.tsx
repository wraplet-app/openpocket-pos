import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listSuppliers, type Supplier } from '../src/repos';
import { useSession } from '../src/session';
import { Screen, IconButton, listProps } from '../src/pos/Screen';
import { SearchField, EmptyState } from '../src/pos/kit';
import { useTheme, initials, space, radius } from '../src/theme';

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
    <Screen
      title="Suppliers"
      scroll={false}
      right={<IconButton icon="add" label="Add supplier" filled onPress={() => router.push('/add-supplier')} />}
    >
      <View style={s.pinned}>
        <SearchField value={q} onChangeText={setQ} placeholder="Search name or phone" />
      </View>

      <FlatList
        {...listProps}
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 96, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<EmptyState icon="business-outline" title="No suppliers yet" hint="Add who you restock from." />}
        renderItem={({ item }) => (
          <View style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.avatar, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800' }}>{initials(item.name)}</Text></View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.name}</Text>
              {item.phone ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{item.phone}</Text> : null}
            </View>
          </View>
        )}
      />

      <Pressable onPress={() => router.push('/new-purchase')} style={[s.fab, { backgroundColor: t.accent, bottom: insets.bottom + 20, boxShadow: t.shadowStrong }]}>
        <Ionicons name="cart-outline" size={20} color={t.accentFg} />
        <Text style={{ color: t.accentFg, fontWeight: '800', marginLeft: space.sm }}>New purchase</Text>
      </Pressable>
    </Screen>
  );
}

const s = StyleSheet.create({
  pinned: { padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.pill },
});
