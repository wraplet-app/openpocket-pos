import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Animated, useWindowDimensions,
  useColorScheme, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createStore } from '../repos';
import { seedDemoData } from '../seed';
import { useTheme, type Theme } from '../theme';

const LOCALE: Record<string, string> = {
  PKR: 'en-PK', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', INR: 'en-IN', AED: 'ar-AE',
};

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: 'storefront-outline', title: 'Run your store,\nyour way', sub: 'A fast, offline point of sale for your shop — no account and no internet needed.' },
  { icon: 'barcode-outline', title: 'Scan. Sell. Done.', sub: 'Ring up sales in seconds. Track stock, customer credit, returns and reports.' },
];

export function Onboarding({ onCreated }: { onCreated: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  const [page, setPage] = useState(0);
  const pageCount = SLIDES.length + 1;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const goTo = (i: number) => scrollRef.current?.scrollTo({ x: i * width, animated: true });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: rise }] }}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
            listener: (e: any) => setPage(Math.round(e.nativeEvent.contentOffset.x / width)),
          })}
        >
          {SLIDES.map((sl, i) => (
            <View key={i} style={{ width, flex: 1, paddingTop: insets.top + 40, paddingHorizontal: 28, alignItems: 'center' }}>
              {i === 0 && (
                <Pressable onPress={() => goTo(pageCount - 1)} style={{ alignSelf: 'flex-end' }} hitSlop={10}>
                  <Text style={{ color: t.muted, fontWeight: '600' }}>Skip</Text>
                </Pressable>
              )}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <View style={[o.hero, { backgroundColor: t.accentSoft }]}>
                  <View style={[o.heroInner, { backgroundColor: t.accent }]}>
                    <Ionicons name={sl.icon} size={56} color={t.accentFg} />
                  </View>
                </View>
                <Text style={[o.title, { color: t.fg }]}>{sl.title}</Text>
                <Text style={[o.sub, { color: t.muted }]}>{sl.sub}</Text>
              </View>
              <Pressable onPress={() => goTo(i + 1)} style={[o.next, { backgroundColor: t.accent, marginBottom: insets.bottom + 40 }]}>
                <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={t.accentFg} style={{ marginLeft: 8 }} />
              </Pressable>
            </View>
          ))}

          {/* setup form page */}
          <View style={{ width }}>
            <SetupForm t={t} insets={insets} onCreated={onCreated} />
          </View>
        </Animated.ScrollView>

        {/* dots */}
        <View style={[o.dots, { bottom: insets.bottom + (page === pageCount - 1 ? 12 : 108) }]} pointerEvents="none">
          {Array.from({ length: pageCount }).map((_, i) => {
            const w = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 22, 8], extrapolate: 'clamp',
            });
            const op = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.3, 1, 0.3], extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={{ width: w, height: 8, borderRadius: 4, marginHorizontal: 3, opacity: op, backgroundColor: t.accent }} />;
          })}
        </View>
      </Animated.View>
    </View>
  );
}

function SetupForm({ t, insets, onCreated }: { t: Theme; insets: { top: number; bottom: number }; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('PKR');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createStore(name.trim(), { code, locale: LOCALE[code] ?? 'en-US', decimals: 2 });
      onCreated();
    } finally { setBusy(false); }
  };

  // Dev-only: one-tap demo store (products, staff, customers, sales).
  const seed = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await seedDemoData();
      onCreated();
    } catch (e) {
      Alert.alert('Could not load demo', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 48, paddingHorizontal: 28, paddingBottom: 40, flexGrow: 1 }}>
        <View style={[o.hero, { backgroundColor: t.accentSoft, alignSelf: 'center', marginBottom: 4 }]}>
          <View style={[o.heroInner, { backgroundColor: t.accent }]}><Ionicons name="bag-handle-outline" size={48} color={t.accentFg} /></View>
        </View>
        <Text style={[o.title, { color: t.fg, fontSize: 24 }]}>Set up your store</Text>
        <Text style={[o.sub, { color: t.muted, marginBottom: 12 }]}>You can change these anytime.</Text>

        <Text style={[o.label, { color: t.muted }]}>STORE NAME</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Kashif Mini Mart" placeholderTextColor={t.muted}
          style={[o.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />

        <Text style={[o.label, { color: t.muted }]}>CURRENCY</Text>
        <View style={o.row}>
          {['PKR', 'USD', 'EUR', 'GBP', 'INR', 'AED'].map((c) => {
            const on = code === c;
            return (
              <Pressable key={c} onPress={() => setCode(c)} style={[o.pill, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.panel }]}>
                <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700' }}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={create} disabled={!name.trim() || busy} style={[o.next, { backgroundColor: t.accent, opacity: !name.trim() || busy ? 0.5 : 1, marginTop: 32, alignSelf: 'stretch' }]}>
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>{busy ? 'Creating…' : 'Create store'}</Text>
        </Pressable>

        {__DEV__ && (
          <Pressable onPress={seed} disabled={busy} style={{ marginTop: 16, alignSelf: 'center' }} hitSlop={10}>
            <Text style={{ color: t.muted, fontWeight: '600' }}>Load demo shop (dev)</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const o = StyleSheet.create({
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  hero: { width: 148, height: 148, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  heroInner: { width: 108, height: 108, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 38 },
  sub: { fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 320 },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignSelf: 'stretch' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, alignSelf: 'flex-start', marginTop: 20, marginBottom: 8 },
  input: { width: '100%', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
});
