import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Modal, Keyboard, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fromMajorString, toMajorNumber, asMinor } from '@openpocket/pos-core';
import {
  getStore, createProduct, getProduct, updateProductFields, listCategories, ensureCategory, DEFAULT_LOW_STOCK,
  type Store, type Category,
} from '../src/repos';
import { pickFromGallery, takePhoto } from '../src/pos/images';
import { lookupBarcode, downloadProductImage } from '../src/pos/lookup';
import { ScanModal } from '../src/pos/ScanModal';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { Chip, PrimaryButton } from '../src/pos/kit';

const UNITS = ['unit', 'pcs', 'pack', 'box', 'dozen', 'kg', 'g', 'L', 'ml'];

/** Add a product, or edit one when opened with ?id=… (stock is adjusted via Purchases, not here). */
export default function AddProduct() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ barcode?: string; id?: string }>();
  const editId = params.id;
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [taxPct, setTaxPct] = useState('0');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('unit');
  const [lowStock, setLowStock] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getStore().then((s) => {
      setStore(s);
      if (s) listCategories(s.id).then(setCategories);
    });
  }, []);

  // Edit mode: load the product into the form.
  useEffect(() => {
    if (!editId || !store) return;
    getProduct(editId).then((p) => {
      if (!p) return;
      const d = store.currency_decimals;
      setName(p.name); setBarcode(p.barcode ?? ''); setImageUri(p.image_uri);
      setPrice(String(toMajorNumber(asMinor(p.selling_price), d)));
      setCost(p.cost_price ? String(toMajorNumber(asMinor(p.cost_price), d)) : '');
      setTaxPct(String(p.tax_bps / 100)); setSku(p.sku ?? ''); setUnit(p.unit ?? 'unit');
      setLowStock(p.low_stock_threshold != null ? String(p.low_stock_threshold) : '');
      setCategoryId(p.category_id ?? null); setCurrentStock(p.stock);
    });
  }, [editId, store]);

  // Auto-fill from Open Food Facts when we arrive with a scanned barcode.
  useEffect(() => { if (params.barcode) lookup(params.barcode, true); }, [params.barcode]);

  /** Look the barcode up online; fill the name (if empty) and product photo. */
  const lookup = async (code: string, silent = false) => {
    const bc = code.trim();
    if (looking) return;
    if (!/^\d{8,14}$/.test(bc)) {
      if (!silent) showAlert('Enter a barcode first', 'Type or scan a product barcode (8–14 digits), then tap Look up to auto-fill the name and photo.');
      return;
    }
    setLooking(true);
    try {
      const info = await lookupBarcode(bc);
      if (!info) { if (!silent) showAlert('Not found', 'No match for this barcode in the product database.'); return; }
      if (info.name) setName((prev) => prev.trim() ? prev : info.name!);
      if (info.imageUrl && !imageUri) {
        const local = await downloadProductImage(info.imageUrl);
        if (local) setImageUri(local);
      }
      if (!silent && !info.name && !info.imageUrl) showAlert('Not found', 'No details available for this barcode.');
    } catch {
      if (!silent) showAlert('Lookup failed', 'Could not reach the product database. Check your connection.');
    } finally { setLooking(false); }
  };

  const pick = async (fn: () => Promise<string | null>) => {
    try { const u = await fn(); if (u) setImageUri(u); }
    catch (e) { showAlert('Could not add photo', e instanceof Error ? e.message : String(e)); }
  };

  // Tapping the photo: view it full-screen if one exists, plus take / gallery.
  // Remove is the ✕ on the preview. The themed alert stacks any number of buttons.
  const chooseImage = () => {
    showAlert('Product photo', undefined, [
      ...(imageUri ? [{ text: 'View photo', onPress: () => setViewing(true) }] : []),
      { text: imageUri ? 'Replace — take photo' : 'Take photo', onPress: () => pick(takePhoto) },
      { text: imageUri ? 'Replace — from gallery' : 'Choose from gallery', onPress: () => pick(pickFromGallery) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const save = async () => {
    if (!store || busy) return;
    const decimals = store.currency_decimals;
    try {
      if (!name.trim()) throw new Error('Name is required');
      const sellingPrice = fromMajorString(price || '0', decimals);
      if (sellingPrice <= 0) throw new Error('Selling price must be greater than 0');
      const costPrice = cost ? fromMajorString(cost, decimals) : asMinor(0);
      const taxBps = Math.round(parseFloat(taxPct || '0') * 100);
      if (!(taxBps >= 0)) throw new Error('Tax % must be 0 or more');
      const openingStock = Math.max(0, Math.floor(parseFloat(stock || '0')));
      const lowStockThreshold = lowStock.trim() === '' ? null : Math.max(0, Math.floor(parseFloat(lowStock)));
      setBusy(true);
      let catId = categoryId;
      if (addingCategory && newCategory.trim()) catId = await ensureCategory(store.id, newCategory);
      const common = { name: name.trim(), barcode: barcode.trim() || null, imageUri, sellingPrice, costPrice, taxBps, sku: sku.trim() || null, unit, categoryId: catId, lowStockThreshold };
      if (editId) await updateProductFields({ id: editId, ...common });
      else await createProduct({ storeId: store.id, ...common, openingStock });
      router.back();
    } catch (e) {
      // Surface the reason clearly — the old inline note sat below the fold,
      // hidden by the keyboard, so a failed save looked like nothing happened.
      Keyboard.dismiss();
      showAlert('Cannot save product', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, opts?: { kb?: 'decimal-pad' | 'number-pad'; ph?: string; caps?: 'none' | 'sentences' | 'words'; req?: boolean }) => (
    <>
      <Text style={[st.label, { color: t.muted }]}>{label}{opts?.req ? <Text style={{ color: t.danger }}> *</Text> : null}</Text>
      <TextInput value={value} onChangeText={set} placeholder={opts?.ph} placeholderTextColor={t.muted}
        keyboardType={opts?.kb} autoCapitalize={opts?.caps} style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
    </>
  );

  const chip = (label: string, on: boolean, onPress: () => void, key?: string) => (
    <Chip key={key ?? label} label={label} on={on} onPress={onPress} />
  );

  // Margin hint so shopkeepers can sanity-check their pricing.
  const sp = parseFloat(price), cp = parseFloat(cost);
  const margin = sp > 0 && cp > 0 && Number.isFinite(sp) && Number.isFinite(cp) ? Math.round(((sp - cp) / sp) * 100) : null;

  return (
    <Screen title={editId ? 'Edit product' : 'Add product'}>
      {params.barcode ? (
        <View style={[st.scanned, { borderColor: t.ok, backgroundColor: t.panel }]}>
          <Text style={{ color: t.muted, fontSize: 12 }}>Scanned barcode</Text>
          <Text style={{ color: t.fg, fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>{params.barcode}</Text>
        </View>
      ) : null}

      <View style={{ alignSelf: 'center', marginTop: params.barcode ? space.lg : 0 }}>
        <Pressable onPress={chooseImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={[st.photo, { borderColor: t.line, backgroundColor: '#fff' }]} resizeMode="contain" />
          ) : (
            <View style={[st.photo, st.photoEmpty, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
              <Ionicons name="camera-outline" size={30} color={t.muted} />
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Add photo</Text>
            </View>
          )}
        </Pressable>
        {imageUri && (
          <Pressable onPress={() => setImageUri(null)} hitSlop={10} style={[st.remove, { backgroundColor: t.danger }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
          </Pressable>
        )}
      </View>

      {field('Name', name, setName, { ph: 'e.g. Cola 500ml', caps: 'words', req: true })}

      <Text style={[st.label, { color: t.muted }]}>Category</Text>
      <View style={st.wrap}>
        {chip('None', !addingCategory && categoryId === null, () => { setAddingCategory(false); setCategoryId(null); })}
        {categories.map((c) => chip(c.name, !addingCategory && categoryId === c.id, () => { setAddingCategory(false); setCategoryId(c.id); }, c.id))}
        {chip('+ New', addingCategory, () => setAddingCategory(true))}
      </View>
      {addingCategory && (
        <TextInput value={newCategory} onChangeText={setNewCategory} placeholder="New category name" placeholderTextColor={t.muted} autoCapitalize="words"
          style={[st.input, { color: t.fg, borderColor: t.accent, backgroundColor: t.panel, marginTop: space.md }]} />
      )}

      <Text style={[st.label, { color: t.muted }]}>Barcode</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextInput value={barcode} onChangeText={setBarcode} placeholder="scan or type (optional)" placeholderTextColor={t.muted}
          keyboardType="number-pad" style={[st.input, { flex: 1, color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
        <Pressable onPress={() => { Keyboard.dismiss(); setScanning(true); }}
          accessibilityLabel="Scan barcode with camera" style={[st.scan, { backgroundColor: t.accent }]}>
          <Ionicons name="barcode-outline" size={22} color={t.accentFg} />
        </Pressable>
        <Pressable onPress={() => lookup(barcode)} disabled={looking}
          style={[st.lookup, { backgroundColor: t.accentSoft, opacity: looking ? 0.6 : 1 }]}>
          {looking ? <ActivityIndicator color={t.accent} size="small" /> : <Ionicons name="sparkles-outline" size={18} color={t.accent} />}
          <Text style={{ color: t.accent, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Look up</Text>
        </Pressable>
      </View>
      <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>Tap the camera to scan, or type a barcode — then it auto-fills the name and photo from Open Food Facts.</Text>

      {field(`Selling price (${store?.currency_code ?? ''})`, price, setPrice, { kb: 'decimal-pad', ph: '0.00', req: true })}
      {field(`Cost price (${store?.currency_code ?? ''})`, cost, setCost, { kb: 'decimal-pad', ph: '0.00 (optional)' })}
      {margin !== null && (
        <Text style={{ color: margin >= 0 ? t.ok : t.danger, fontSize: 12, marginTop: 6, fontWeight: '600' }}>
          {margin >= 0 ? `${margin}% margin` : `Selling below cost (${margin}%)`}
        </Text>
      )}
      {field('Tax %', taxPct, setTaxPct, { kb: 'decimal-pad', ph: '0' })}

      {field('SKU / item code', sku, setSku, { ph: 'optional', caps: 'none' })}
      <Text style={[st.label, { color: t.muted }]}>Unit</Text>
      <View style={st.wrap}>{UNITS.map((u) => chip(u, unit === u, () => setUnit(u)))}</View>

      {editId ? (
        <>
          <Text style={[st.label, { color: t.muted }]}>Stock on hand</Text>
          <View style={[st.input, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
            <Text style={{ color: t.fg, fontSize: 16 }}>{currentStock ?? '…'} {unit}</Text>
          </View>
          <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>Change stock from More → Purchases / restock so every movement is recorded.</Text>
        </>
      ) : (
        field('Opening stock', stock, setStock, { kb: 'number-pad', ph: '0' })
      )}
      {field('Low-stock alert at', lowStock, setLowStock, { kb: 'number-pad', ph: `${DEFAULT_LOW_STOCK} (default)` })}

      {/* Save lives at the end of the form (not a pinned bar), so it scrolls up
          with the keyboard the same way the onboarding form does. */}
      <View style={{ marginTop: space.xl }}>
        <PrimaryButton label={editId ? 'Save changes' : 'Save product'} onPress={save} busy={busy} disabled={!store} />
      </View>

      {/* Full-screen photo viewer */}
      <Modal visible={viewing && !!imageUri} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewing(false)}>
        <Pressable style={st.viewer} onPress={() => setViewing(false)}>
          {imageUri ? <Image source={{ uri: imageUri }} style={st.viewerImg} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewing(false)} hitSlop={12} style={st.viewerClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Camera barcode scanner */}
      <ScanModal visible={scanning} onClose={() => setScanning(false)} onScan={(code) => { setBarcode(code); lookup(code); }} />
    </Screen>
  );
}

const st = StyleSheet.create({
  scanned: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  lookup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: 14 },
  scan: { width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  photo: { width: 120, height: 120, borderRadius: radius.lg, borderWidth: 1 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  remove: { position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  viewerImg: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: space.xxl, right: space.xl, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
