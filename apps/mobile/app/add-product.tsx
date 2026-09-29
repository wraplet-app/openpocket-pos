import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fromMajorString, asMinor } from '@openpocket/pos-core';
import { getStore, createProduct, type Store } from '../src/repos';
import { pickFromGallery, takePhoto } from '../src/pos/images';
import { lookupBarcode, downloadProductImage } from '../src/pos/lookup';
import { useTheme } from '../src/theme';

export default function AddProduct() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [taxPct, setTaxPct] = useState('0');
  const [stock, setStock] = useState('0');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getStore().then(setStore); }, []);

  // Auto-fill from Open Food Facts when we arrive with a scanned barcode.
  useEffect(() => { if (params.barcode) lookup(params.barcode, true); }, [params.barcode]);

  /** Look the barcode up online; fill the name (if empty) and product photo. */
  const lookup = async (code: string, silent = false) => {
    const bc = code.trim();
    if (!/^\d{8,14}$/.test(bc) || looking) return;
    setLooking(true);
    try {
      const info = await lookupBarcode(bc);
      if (!info) { if (!silent) Alert.alert('Not found', 'No match for this barcode in the product database.'); return; }
      if (info.name) setName((prev) => prev.trim() ? prev : info.name!);
      if (info.imageUrl && !imageUri) {
        const local = await downloadProductImage(info.imageUrl);
        if (local) setImageUri(local);
      }
      if (!silent && !info.name && !info.imageUrl) Alert.alert('Not found', 'No details available for this barcode.');
    } catch {
      if (!silent) Alert.alert('Lookup failed', 'Could not reach the product database. Check your connection.');
    } finally { setLooking(false); }
  };

  // Android's native Alert renders at most 3 buttons, so keep it to
  // Camera / Gallery / Cancel and expose Remove as an ✕ on the preview.
  const chooseImage = () => {
    Alert.alert('Product photo', undefined, [
      { text: 'Take photo', onPress: async () => { const u = await takePhoto(); if (u) setImageUri(u); } },
      { text: 'Choose from gallery', onPress: async () => { const u = await pickFromGallery(); if (u) setImageUri(u); } },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const save = async () => {
    if (!store || busy) return;
    setErr(null);
    const decimals = store.currency_decimals;
    try {
      if (!name.trim()) throw new Error('Name is required');
      const sellingPrice = fromMajorString(price || '0', decimals);
      if (sellingPrice <= 0) throw new Error('Selling price must be greater than 0');
      const costPrice = cost ? fromMajorString(cost, decimals) : asMinor(0);
      const taxBps = Math.round(parseFloat(taxPct || '0') * 100);
      const openingStock = Math.max(0, Math.floor(parseFloat(stock || '0')));
      setBusy(true);
      await createProduct({ storeId: store.id, name: name.trim(), barcode: barcode.trim() || null, imageUri, sellingPrice, costPrice, taxBps, openingStock });
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, opts?: { kb?: 'decimal-pad' | 'number-pad'; ph?: string }) => (
    <>
      <Text style={[st.label, { color: t.muted }]}>{label}</Text>
      <TextInput value={value} onChangeText={set} placeholder={opts?.ph} placeholderTextColor={t.muted}
        keyboardType={opts?.kb} style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
    </>
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, backgroundColor: t.bg, flexGrow: 1 }}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ color: t.fg, fontSize: 18, fontWeight: '700' }}>Add product</Text>
        <View style={{ width: 50 }} />
      </View>

      {params.barcode ? (
        <View style={[st.scanned, { borderColor: t.ok, backgroundColor: t.panel }]}>
          <Text style={{ color: t.muted, fontSize: 12 }}>Scanned barcode</Text>
          <Text style={{ color: t.fg, fontSize: 16, fontWeight: '700', letterSpacing: 1 }}>{params.barcode}</Text>
        </View>
      ) : null}

      <View style={{ alignSelf: 'center', marginTop: 8 }}>
        <Pressable onPress={chooseImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={[st.photo, { borderColor: t.line }]} />
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

      {field('Name', name, setName, { ph: 'e.g. Cola 500ml' })}

      <Text style={[st.label, { color: t.muted }]}>Barcode</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={barcode} onChangeText={setBarcode} placeholder="scan or type (optional)" placeholderTextColor={t.muted}
          keyboardType="number-pad" style={[st.input, { flex: 1, color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
        <Pressable onPress={() => lookup(barcode)} disabled={looking || !/^\d{8,14}$/.test(barcode.trim())}
          style={[st.lookup, { backgroundColor: t.accentSoft, opacity: looking || !/^\d{8,14}$/.test(barcode.trim()) ? 0.5 : 1 }]}>
          {looking ? <ActivityIndicator color={t.accent} size="small" /> : <Ionicons name="sparkles-outline" size={18} color={t.accent} />}
          <Text style={{ color: t.accent, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Look up</Text>
        </Pressable>
      </View>
      <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>Auto-fills name and photo from the Open Food Facts database.</Text>
      {field(`Selling price (${store?.currency_code ?? ''})`, price, setPrice, { kb: 'decimal-pad', ph: '0.00' })}
      {field(`Cost price (${store?.currency_code ?? ''})`, cost, setCost, { kb: 'decimal-pad', ph: '0.00 (optional)' })}
      {field('Tax %', taxPct, setTaxPct, { kb: 'decimal-pad', ph: '0' })}
      {field('Opening stock', stock, setStock, { kb: 'number-pad', ph: '0' })}

      {err && <Text style={{ color: t.danger, marginTop: 14 }}>{err}</Text>}

      <Pressable onPress={save} disabled={busy || !store}
        style={[st.primary, { backgroundColor: t.accent, opacity: busy || !store ? 0.5 : 1 }]}>
        <Text style={{ color: t.accentFg, fontWeight: '700', fontSize: 17 }}>{busy ? 'Saving…' : 'Save product'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  scanned: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  lookup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14 },
  photo: { width: 120, height: 120, borderRadius: 20, borderWidth: 1 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  remove: { position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primary: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
});
