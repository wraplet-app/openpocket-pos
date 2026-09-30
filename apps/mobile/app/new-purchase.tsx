import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fromMajorString, asMinor } from '@openpocket/pos-core';
import { listProducts, listSuppliers, createPurchase, type Product, type Supplier, type PurchaseLine } from '../src/repos';
import { useSession } from '../src/session';
import { usePurchaseDraft } from '../src/purchaseDraft';
import { useMoney } from '../src/pos/ui';
import { useTheme, space, radius } from '../src/theme';
import { Screen, listProps } from '../src/pos/Screen';
import { Chip, ChipRow, PrimaryButton } from '../src/pos/kit';

export default function NewPurchase() {
  const t = useTheme();
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
      showAlert('Purchase received', `${r.referenceNo} · ${r.itemCount} item${r.itemCount === 1 ? '' : 's'} · ${money(r.total)}. Stock updated.`);
      router.back();
    } catch (e) {
      showAlert('Could not save purchase', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const footerLabel = lineCount === 0 ? 'Scan or set quantities' : `Receive ${lineCount} item${lineCount === 1 ? '' : 's'} · ${money(asMinor(total))}`;

  return (
    <Screen
      title="New purchase"
      scroll={false}
      right={<Pressable onPress={() => { draft.reset(); }} hitSlop={8}><Text style={{ color: t.muted, fontWeight: '600' }}>Clear</Text></Pressable>}
      footer={<PrimaryButton icon="cube-outline" label={footerLabel} onPress={save} busy={busy} disabled={lineCount === 0} />}
    >
      <View style={s.pinned}>
        {/* Big scan-to-add action */}
        <Pressable onPress={() => router.push('/scan?mode=stock')} style={[s.scanBtn, { backgroundColor: t.accent }]}>
          <Ionicons name="barcode-outline" size={24} color={t.accentFg} />
          <View style={{ marginLeft: space.md }}>
            <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>Scan barcode to add stock</Text>
            <Text style={{ color: t.accentFg, opacity: 0.9, fontSize: 12, marginTop: 1 }}>Fastest way — scan each item to restock</Text>
          </View>
        </Pressable>

        <Text style={[s.label, { color: t.muted }]}>Supplier</Text>
        <ChipRow>
          <Chip label="No supplier" on={draft.supplierId === null} onPress={() => draft.setSupplier(null)} />
          {suppliers.map((sp) => (
            <Chip key={sp.id} label={sp.name} on={draft.supplierId === sp.id} onPress={() => draft.setSupplier(sp.id)} />
          ))}
          <Pressable onPress={() => router.push('/add-supplier')} style={[s.newChip, { borderColor: t.accent }]}>
            <Ionicons name="add" size={16} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.xs }}>New</Text>
          </Pressable>
        </ChipRow>

        <Text style={[s.label, { color: t.muted, marginTop: space.lg }]}>Items · set quantity & cost</Text>
      </View>

      {products.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: space.xxl, paddingHorizontal: space.xl }}>
          <Text style={{ color: t.muted, textAlign: 'center' }}>Add products first, then scan or set quantities to restock.</Text>
        </View>
      ) : (
        <FlatList
          {...listProps}
          data={ordered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
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
                  <View style={[s.stepper, { borderColor: t.line, backgroundColor: t.surfaceAlt, marginTop: space.sm }]}>
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
    </Screen>
  );
}

const s = StyleSheet.create({
  pinned: { paddingHorizontal: space.lg, paddingTop: space.lg },
  scanBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm },
  label: { fontSize: 13, fontWeight: '600', marginTop: space.sm, marginBottom: space.sm },
  newChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.pill, paddingHorizontal: 14, height: 36, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  costWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: space.sm },
  stepper: { borderWidth: 1, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs, paddingVertical: 3, gap: 2 },
  stepBtn: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
});
