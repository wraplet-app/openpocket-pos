import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listProducts, type Product } from '../../src/repos';
import { useSession } from '../../src/session';
import { ProductCard } from '../../src/pos/ProductCard';
import { useTheme } from '../../src/theme';

type Filter = 'all' | 'low' | 'out';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
];

export default function Products() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(useCallback(() => { listProducts(store.id).then(setProducts); }, [store.id]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === 'low' && !(p.stock > 0 && p.stock <= 5)) return false;
      if (filter === 'out' && p.stock > 0) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q);
    });
  }, [products, query, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 10 }}>
      <View style={s.header}>
        <Text style={{ color: t.fg, fontSize: 24, fontWeight: '800' }}>Products</Text>
        <Pressable onPress={() => router.push('/add-product')} style={[s.add, { backgroundColor: t.accent, boxShadow: t.shadow }]}>
          <Ionicons name="add" size={24} color={t.accentFg} />
        </Pressable>
      </View>

      <View style={[s.search, { backgroundColor: t.panel, borderColor: t.line }]}>
        <Ionicons name="search-outline" size={18} color={t.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search name or barcode" placeholderTextColor={t.muted}
          style={{ flex: 1, marginLeft: 8, color: t.fg, fontSize: 15, paddingVertical: 0 }} />
        <Pressable onPress={() => router.push('/scan')} hitSlop={8}><Ionicons name="barcode-outline" size={20} color={t.accent} /></Pressable>
      </View>

      <View style={s.chips}>
        {FILTERS.map(({ key, label }) => {
          const on = filter === key;
          return (
            <Pressable key={key} onPress={() => setFilter(key)}
              style={[s.chip, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel }]}>
              <Text style={{ color: on ? t.accent : t.fg, fontWeight: '600', fontSize: 13 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {products.length === 0 ? (
        <View style={s.center}>
          <View style={[s.emptyIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name="cube-outline" size={30} color={t.muted} /></View>
          <Text style={{ color: t.fg, fontWeight: '700', fontSize: 16, marginTop: 16 }}>No products yet</Text>
          <Text style={{ color: t.muted, marginTop: 4, marginBottom: 20 }}>Add one, or scan a barcode to start.</Text>
          <Pressable onPress={() => router.push('/add-product')} style={[s.primary, { backgroundColor: t.accent }]}>
            <Ionicons name="add" size={18} color={t.accentFg} />
            <Text style={{ color: t.accentFg, fontWeight: '800', marginLeft: 6 }}>Add product</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 170 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 40 }}>No match.</Text>}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 14, height: 48, borderRadius: 14, borderWidth: 1 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 26 },
});
