import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { computeCart, asMinor, asBps } from '@openpocket/pos-core';
import { getStore, findProductByBarcode, type Store, type Product } from '../src/repos';
import { useCart } from '../src/cart';
import { usePurchaseDraft } from '../src/purchaseDraft';
import { useCheckoutUI } from '../src/checkoutUI';
import { useMoney } from '../src/pos/ui';
import { Thumb } from '../src/pos/Thumb';
import { useTheme, space, radius, type as ty } from '../src/theme';
import { Screen, IconButton, listProps } from '../src/pos/Screen';

interface ScanRow { product: Product; quantity: number }

export default function Scan() {
  const t = useTheme();
  const router = useRouter();
  const money = useMoney();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isStock = mode === 'stock';
  const cart = useCart();
  const draft = usePurchaseDraft();
  const openCheckout = useCheckoutUI((s) => s.openCheckout);
  const [permission, requestPermission] = useCameraPermissions();
  const [store, setStore] = useState<Store | null>(null);
  const [torch, setTorch] = useState(false);
  const [banner, setBanner] = useState<{ text: string; ok: boolean } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  // Remember every product we've touched so restock rows can show name/price/photo.
  const [seen, setSeen] = useState<Record<string, Product>>({});
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { getStore().then(setStore); }, []);
  useEffect(() => { if (permission && !permission.granted) requestPermission(); }, [permission]);

  const flash = (text: string, ok: boolean) => {
    setBanner({ text, ok });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1600);
  };

  // Rows to show under "Recently added", newest edits first isn't tracked, so
  // we show cart/draft contents (which is what the cashier is building).
  const rows: ScanRow[] = useMemo(() => {
    if (isStock) return Object.entries(draft.qty).filter(([, q]) => q > 0).map(([id, q]) => ({ product: seen[id]!, quantity: q })).filter((r) => r.product);
    return Object.values(cart.items).map((it) => ({ product: it.product, quantity: it.quantity }));
  }, [isStock, cart.items, draft.qty, seen]);

  const totals = computeCart(rows.map((r) => ({ unitPrice: asMinor(r.product.selling_price), quantity: r.quantity, taxBps: asBps(r.product.tax_bps) })));
  const count = rows.reduce((n, r) => n + r.quantity, 0);

  const handleCode = useCallback(async (raw: string) => {
    if (!store) return;
    const code = raw.trim();
    if (!code) return;
    const product = await findProductByBarcode(store.id, code);
    if (!product) {
      Vibration.vibrate(120);
      router.push({ pathname: '/add-product', params: { barcode: code } });
      return;
    }
    setSeen((m) => ({ ...m, [product.id]: product }));
    if (isStock) {
      draft.ensureCost(product.id, (product.cost_price / 10 ** store.currency_decimals).toFixed(store.currency_decimals));
      draft.bump(product.id);
      Vibration.vibrate(40);
      flash(`Added ${product.name}`, true);
    } else if (product.stock <= (cart.items[product.id]?.quantity ?? 0)) {
      Vibration.vibrate(120);
      flash(`${product.name} — out of stock`, false);
    } else {
      cart.add(product);
      Vibration.vibrate(40);
      flash(`Added ${product.name}`, true);
    }
  }, [store, isStock]);

  const onScan = useCallback((r: BarcodeScanningResult) => {
    const now = Date.now();
    const code = r.data.trim();
    if (now - lastScan.current.at < 700) return;
    if (code === lastScan.current.code && now - lastScan.current.at < 1500) return;
    lastScan.current = { code, at: now };
    handleCode(code);
  }, [handleCode]);

  const setQty = (id: string, q: number) => { isStock ? draft.setQty(id, Math.max(0, q)) : cart.setQty(id, q); };

  const submitManual = () => {
    const code = manualCode.trim();
    setManualOpen(false);
    setManualCode('');
    if (code) handleCode(code);
  };

  const finish = () => {
    if (isStock) { router.back(); return; }
    if (count === 0) { router.back(); return; }
    openCheckout();
    router.back();
  };

  const title = isStock ? 'Restock' : 'Scan';
  if (!permission) return <Screen title={title} scroll={false}><View /></Screen>;
  if (!permission.granted) {
    return (
      <Screen title={title} scroll={false}>
        <View style={st.center}>
          <View style={[st.permIcon, { backgroundColor: t.accentSoft }]}><Ionicons name="camera-outline" size={30} color={t.accent} /></View>
          <Text style={[ty.h2, { color: t.fg, marginTop: space.lg }]}>Camera access needed</Text>
          <Text style={[ty.body, { color: t.muted, textAlign: 'center', marginTop: space.sm, marginBottom: space.xl }]}>Allow the camera to scan product barcodes.</Text>
          <Pressable onPress={requestPermission} style={[st.grant, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800' }}>Grant camera access</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: space.lg }}><Text style={{ color: t.muted }}>Cancel</Text></Pressable>
        </View>
      </Screen>
    );
  }

  const checkoutBar = (
    <Pressable onPress={finish} disabled={!isStock && count === 0}
      style={[st.checkout, { backgroundColor: t.accent, opacity: !isStock && count === 0 ? 0.5 : 1 }]}>
      <View style={[st.cartBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Ionicons name={isStock ? 'cube' : 'cart'} size={18} color={t.accentFg} /></View>
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={{ color: t.accentFg, opacity: 0.9, fontSize: 12 }}>{count} item{count === 1 ? '' : 's'}</Text>
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 18 }}>{money(totals.grandTotal)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>{isStock ? 'Review' : 'Checkout'}</Text>
        <Ionicons name="arrow-forward" size={18} color={t.accentFg} style={{ marginLeft: 6 }} />
      </View>
    </Pressable>
  );

  return (
    <Screen
      title={title}
      scroll={false}
      footer={checkoutBar}
      right={<IconButton icon={torch ? 'flash' : 'flash-off'} label={torch ? 'Turn torch off' : 'Turn torch on'} filled={torch} onPress={() => setTorch((v) => !v)} />}
    >
      {/* camera card */}
      <View style={[st.camCard, { borderColor: t.line }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          onBarcodeScanned={onScan}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'] }}
        />
        <View style={st.camScrim} pointerEvents="none" />
        <View style={st.camLabel} pointerEvents="none">
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Scan a product</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>Point your camera at a barcode or QR code</Text>
        </View>
        <View style={st.reticle} pointerEvents="none">
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => <View key={c} style={[st.corner, cornerStyle(c, t.accent)]} />)}
        </View>
        {banner && (
          <View style={[st.banner, { backgroundColor: banner.ok ? 'rgba(12,166,120,0.96)' : 'rgba(220,38,38,0.96)' }]} pointerEvents="none">
            <Ionicons name={banner.ok ? 'checkmark-circle' : 'alert-circle'} size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>{banner.text}</Text>
          </View>
        )}
        <Pressable onPress={() => setManualOpen(true)} style={st.manualBtn}>
          <Ionicons name="keypad-outline" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Enter code manually</Text>
        </Pressable>
      </View>

      {/* recently added */}
      <View style={st.listHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[ty.h2, { color: t.fg }]}>Recently added</Text>
          {count > 0 && <View style={[st.countPill, { backgroundColor: t.accentSoft }]}><Text style={{ color: t.accent, fontWeight: '800', fontSize: 12 }}>{count}</Text></View>}
        </View>
        <Pressable onPress={() => setManualOpen(true)} hitSlop={8}><Text style={{ color: t.accent, fontWeight: '700' }}>Add item</Text></Pressable>
      </View>

      <FlatList
        {...listProps}
        data={rows}
        keyExtractor={(r) => r.product.id}
        style={st.list}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListEmptyComponent={<Text style={[ty.body, { color: t.muted, textAlign: 'center', marginTop: space.xxl }]}>Scan an item to get started.</Text>}
        renderItem={({ item }) => {
          const line = (item.product.selling_price * item.quantity) as number;
          return (
            <View style={[st.row, { backgroundColor: t.panel, borderColor: t.line }]}>
              <Thumb uri={item.product.image_uri} name={item.product.name} style={st.thumb} textSize={15} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={[ty.body, { color: t.fg, fontWeight: '700' }]} numberOfLines={1}>{item.product.name}</Text>
                <Text style={[ty.small, { color: t.muted, marginTop: 2 }]}>{money(asMinor(item.product.selling_price))} each</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: t.fg, fontWeight: '800', marginBottom: 6 }}>{money(asMinor(line))}</Text>
                <View style={[st.stepper, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
                  <Pressable onPress={() => setQty(item.product.id, item.quantity - 1)} style={st.stepBtn} hitSlop={6}><Ionicons name="remove" size={16} color={t.fg} /></Pressable>
                  <Text style={{ color: t.fg, fontWeight: '800', minWidth: 18, textAlign: 'center' }}>{item.quantity}</Text>
                  <Pressable onPress={() => setQty(item.product.id, item.quantity + 1)} style={st.stepBtn} hitSlop={6}><Ionicons name="add" size={16} color={t.fg} /></Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* manual entry */}
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <Pressable style={st.modalBackdrop} onPress={() => setManualOpen(false)}>
          <Pressable style={[st.modalCard, { backgroundColor: t.panel }]} onPress={() => {}}>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 17, marginBottom: 12 }}>Enter barcode</Text>
            <TextInput value={manualCode} onChangeText={setManualCode} autoFocus keyboardType="number-pad"
              placeholder="type the barcode number" placeholderTextColor={t.muted}
              style={[st.modalInput, { color: t.fg, borderColor: t.line, backgroundColor: t.surfaceAlt }]} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => { setManualOpen(false); setManualCode(''); }} style={[st.modalBtn, { backgroundColor: t.surfaceAlt }]}>
                <Text style={{ color: t.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitManual} style={[st.modalBtn, { backgroundColor: t.accent }]}>
                <Text style={{ color: t.accentFg, fontWeight: '800' }}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function cornerStyle(c: 'tl' | 'tr' | 'bl' | 'br', color: string) {
  const w = 3;
  const base: any = { position: 'absolute', width: 26, height: 26, borderColor: color };
  if (c === 'tl') return { ...base, top: 0, left: 0, borderTopWidth: w, borderLeftWidth: w, borderTopLeftRadius: 10 };
  if (c === 'tr') return { ...base, top: 0, right: 0, borderTopWidth: w, borderRightWidth: w, borderTopRightRadius: 10 };
  if (c === 'bl') return { ...base, bottom: 0, left: 0, borderBottomWidth: w, borderLeftWidth: w, borderBottomLeftRadius: 10 };
  return { ...base, bottom: 0, right: 0, borderBottomWidth: w, borderRightWidth: w, borderBottomRightRadius: 10 };
}

const st = StyleSheet.create({
  camScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 78, backgroundColor: 'rgba(0,0,0,0.38)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  permIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  grant: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: space.xxl },
  camCard: { height: 260, marginHorizontal: space.lg, marginTop: space.lg, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden', backgroundColor: '#000' },
  list: { flex: 1 },
  camLabel: { position: 'absolute', top: 16, left: 16, right: 16 },
  reticle: { position: 'absolute', top: 90, left: 60, right: 60, bottom: 90 },
  corner: {},
  banner: { position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  manualBtn: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, marginTop: space.lg, marginBottom: space.sm },
  countPill: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: radius.lg },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.xs, paddingVertical: 2, gap: 2 },
  stepBtn: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center' },
  checkout: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 14 },
  cartBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 20, padding: 20 },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  modalBtn: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 13 },
});
