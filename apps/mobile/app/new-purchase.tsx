import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ScrollView, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fromMajorString, asMinor } from '@openpocket/pos-core';
import { listProducts, listSuppliers, createPurchase, type Product, type Supplier, type PurchaseLine } from '../src/repos';
import { useSession } from '../src/session';
import { usePurchaseDraft } from '../src/purchaseDraft';
import { useMoney } from '../src/pos/ui';
import { useTheme } from '../src/theme';

export default function NewPurchase() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const money = useMoney();
  const dec = store.currency_decimals;
  const draft = usePurchaseDraft();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    listProducts(store.id).then((ps) => {
      setProducts(ps);
      for (const p of ps) draft.ensureCost(p.id, (p.cost_price / 10 ** dec).toFixed(dec));
    });
    listSuppliers(store.id).then(setSuppliers);
  }, [store.id, dec]));

  const parseCost = (id: string): number => {
    try { return fromMajorString(draft.cost[id] || '0', dec); } catch { return 0; }
  };
  const total = useMemo(
    () => products.reduce((n, p) => n + (draft.qty[p.id] ?? 0) * parseCost(p.id), 0),
    [products, draft.qty, draft.cost],
  );
  const lineCount = products.filter((p) => (draft.qty[p.id] ?? 0) > 0).length;

  // show scanned/added items first
  const ordered = useMemo(
    () => [...products].sort((a, b) => ((draft.qty[b.id] ?? 0) > 0 ? 1 : 0) - ((draft.qty[a.id] ?? 0) > 0 ? 1 : 0)),
    [products, draft.qty],
  );

  const save = async () => {
    if (lineCount === 0 || busy) return;
    setBusy(true);
    try {
      const lines: PurchaseLine[] = products
        .filter((p) => (draft.qty[p.id] ?? 0) > 0)
        .map((p) => ({ productId: p.id, name: p.name, quantity: draft.qty[p.id]!, unitCost: asMinor(parseCost(p.id)) }));
      const r = await createPurchase(store.id, draft.supplierId, lines);
      draft.reset();
      Alert.alert('Purchase received', `${r.referenceNo} · ${r.itemCount} item${r.itemCount === 1 ? '' : 's'} · ${money(r.total)}. Stock updated.`);
      router.back();
    } catch (e) {
      Alert.alert('Could not save purchase', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 10 }}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={24} color={t.fg} /></Pressable>
        <Text style={{ color: t.fg, fontSize: 18, fontWeight: '800' }}>New purchase</Text>
        <Pressable onPress={() => { draft.reset(); }} hitSlop={8}><Text style={{ color: t.muted, fontWeight: '600' }}>Clear</Text></Pressable>
      </View>

      {/* Big scan-to-add action */}
      <Pressable onPress={() => router.push('/scan?mode=stock')} style={[s.scanBtn, { backgroundColor: t.accent }]}>
        <Ionicons name="barcode-outline" size={24} color={t.accentFg} />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>Scan barcode to add stock</Text>
          <Text style={{ color: t.accentFg, opacity: 0.9, fontSize: 12, marginTop: 1 }}>Fastest way — scan each item to restock</Text>
        </View>
      </Pressable>

      <Text style={[s.label, { color: t.muted }]}>SUPPLIER</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Chip label="No supplier" on={draft.supplierId === null} onPress={() => draft.setSupplier(null)} t={t} />
        {suppliers.map((sp) => (
          <Chip key={sp.id} label={sp.name} on={draft.supplierId === sp.id} onPress={() => draft.setSupplier(sp.id)} t={t} />
        ))}
        <Pressable onPress={() => router.push('/add-supplier')} style={[s.chip, { borderColor: t.accent, borderStyle: 'dashed' }]}>
          <Ionicons name="add" size={16} color={t.accent} />
          <Text style={{ color: t.accent, fontWeight: '700', marginLeft: 4 }}>New</Text>
        </Pressable>
      </ScrollView>

      <Text style={[s.label, { color: t.muted, marginTop: 16 }]}>ITEMS · SET QUANTITY & COST</Text>
      {products.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
          <Text style={{ color: t.muted, textAlign: 'center' }}>Add products first, then scan or set quantities to restock.</Text>
        </View>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const q = draft.qty[item.id] ?? 0;
            return (
              <View style={[s.row, { backgroundColor: t.panel, borderColor: q > 0 ? t.accent : t.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fg, fontWeight: '700' }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>in stock {item.stock}{q > 0 ? ` → ${item.stock + q}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[s.costWrap, { borderColor: t.line, backgroundColor: t.bg }]}>
                    <Text style={{ color: t.muted, fontSize: 12 }}>{store.currency_code} </Text>
                    <TextInput value={draft.cost[item.id] ?? ''} onChangeText={(v) => draft.setCost(item.id, v)}
                      keyboardType="decimal-pad" placeholder="cost" placeholderTextColor={t.muted}
                      style={{ color: t.fg, fontWeight: '700', minWidth: 56, padding: 0, textAlign: 'right' }} />
                  </View>
                  <View style={[s.stepper, { borderColor: t.line, backgroundColor: t.surfaceAlt, marginTop: 8 }]}>
                    <Pressable onPress={() => draft.setQty(item.id, q - 1)} style={s.stepBtn} hitSlop={6}><Ionicons name="remove" size={18} color={t.fg} /></Pressable>
                    <Text style={{ color: t.fg, fontWeight: '800', minWidth: 22, textAlign: 'center' }}>{q}</Text>
                    <Pressable onPress={() => draft.setQty(item.id, q + 1)} style={s.stepBtn} hitSlop={6}><Ionicons name="add" size={18} color={t.fg} /></Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[s.bottom, { paddingBottom: insets.bottom + 14, backgroundColor: t.panel, borderColor: t.line }]}>
        <Pressable onPress={save} disabled={lineCount === 0 || busy} style={[s.primary, { backgroundColor: t.accent, opacity: lineCount === 0 || busy ? 0.5 : 1 }]}>
          <Ionicons name="cube-outline" size={18} color={t.accentFg} />
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: 8 }}>
            {busy ? 'Saving…' : lineCount === 0 ? 'Scan or set quantities' : `Receive ${lineCount} item${lineCount === 1 ? '' : 's'} · ${money(asMinor(total))}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Chip({ label, on, onPress, t }: { label: string; on: boolean; onPress: () => void; t: ReturnType<typeof useTheme> }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel }]}>
      <Text style={{ color: on ? t.accent : t.fg, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginHorizontal: 16, marginBottom: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12 },
  costWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  stepper: { borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 3, gap: 2 },
  stepBtn: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
});
