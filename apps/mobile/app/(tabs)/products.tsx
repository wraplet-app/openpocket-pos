import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { listProducts, isLowStock, type Product } from '../../src/repos';
import { useSession } from '../../src/session';
import { useRole } from '../../src/session';
import { can } from '../../src/roles';
import { ProductCard } from '../../src/pos/ProductCard';
import { TabHeader, IconButton, listProps, useTabListInset } from '../../src/pos/Screen';
import { SearchField, Chip, ChipRow, ChipDivider, EmptyState } from '../../src/pos/kit';
import { useTheme, space } from '../../src/theme';

type StockFilter = 'low' | 'out' | null;

export default function Products() {
  const t = useTheme();
  const router = useRouter();
  const listInset = useTabListInset();
  const store = useSession((s) => s.store)!;
  const canEdit = can(useRole(), 'products');
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>(null);
  const [category, setCategory] = useState<string | null>(null); // category id

  useFocusEffect(useCallback(() => { listProducts(store.id).then(setProducts); }, [store.id]));

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of products) if (p.category_id && p.category_name) seen.set(p.category_id, p.category_name);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const counts = useMemo(() => ({
    low: products.filter(isLowStock).length,
    out: products.filter((p) => p.stock <= 0).length,
  }), [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (stockFilter === 'low' && !isLowStock(p)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (category && p.category_id !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q) || (p.sku ?? '').toLowerCase().includes(q)
        || (p.category_name ?? '').toLowerCase().includes(q);
    });
  }, [products, query, stockFilter, category]);

  const allOn = stockFilter === null && category === null;
  const reset = () => { setStockFilter(null); setCategory(null); };

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <TabHeader
        title="Products"
        subtitle={products.length ? `${products.length} items` : undefined}
        right={canEdit ? <IconButton icon="add" label="Add product" filled onPress={() => router.push('/add-product')} /> : undefined}
      >
        <View style={s.controls}>
          <SearchField
            value={query} onChangeText={setQuery} placeholder="Search name, barcode or SKU"
            right={<Pressable onPress={() => router.push('/scan')} hitSlop={10} accessibilityLabel="Scan barcode"><Ionicons name="barcode-outline" size={20} color={t.accent} /></Pressable>}
          />
          <ChipRow>
            <Chip label="All" on={allOn} onPress={reset} />
            <Chip label="Low stock" count={counts.low || undefined} on={stockFilter === 'low'} onPress={() => setStockFilter(stockFilter === 'low' ? null : 'low')} />
            <Chip label="Out of stock" count={counts.out || undefined} on={stockFilter === 'out'} onPress={() => setStockFilter(stockFilter === 'out' ? null : 'out')} />
            {categories.length > 0 && <ChipDivider />}
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} on={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />
            ))}
          </ChipRow>
        </View>
      </TabHeader>

      {products.length === 0 ? (
        <EmptyState icon="cube-outline" title="No products yet" hint="Add one, or scan a barcode to start."
          action={canEdit ? { label: 'Add product', onPress: () => router.push('/add-product') } : undefined} />
      ) : (
        <FlatList
          {...listProps}
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: space.lg, paddingBottom: listInset }}
          columnWrapperStyle={{ gap: space.md }}
          ItemSeparatorComponent={Gap}
          ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', marginTop: 48 }}>No products match.</Text>}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </View>
  );
}

const Gap = () => <View style={{ height: space.md }} />;

const s = StyleSheet.create({
  root: { flex: 1 },
  controls: { gap: space.md, marginTop: space.xs },
});
