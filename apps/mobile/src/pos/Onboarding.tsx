import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Animated, useWindowDimensions,
  useColorScheme, StyleSheet, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { showAlert } from './alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createStore, type StoreProfile } from '../repos';
import { seedDemoData } from '../seed';
import { useTheme, type Theme } from '../theme';
import { DEFAULT_ACCENT, CURRENCIES, defaultCurrencyFor, localeForCurrency } from '../branding';
import { ShopDetailsFields, ReceiptFields, ReceiptPreview } from './StoreProfileForm';


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
        {page < pageCount - 1 && <View style={[o.dots, { bottom: insets.bottom + 108 }]} pointerEvents="none">
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
        </View>}
      </Animated.View>
    </View>
  );
}

const EMPTY_PROFILE: StoreProfile = {
  name: '', address: '', phone: '', email: '', website: '', taxId: '', tagline: '', logoUri: null,
  receiptFooter: '', receiptTerms: '', receiptAccent: DEFAULT_ACCENT, receiptPaper: 'a4',
  showLogo: true, showContact: true, showStaff: true,
};

function SetupForm({ t, insets, onCreated }: { t: Theme; insets: { top: number; bottom: number }; onCreated: () => void }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [profile, setProfile] = useState<StoreProfile>(EMPTY_PROFILE);
  // Start from the device's region (US → USD, GB → GBP, DE → EUR …); always changeable.
  const [code, setCode] = useState(() => defaultCurrencyFor(Intl.DateTimeFormat().resolvedOptions().locale));
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const patch = (p: Partial<StoreProfile>) => setProfile((prev) => ({ ...prev, ...p }));
  const currency = { code, locale: localeForCurrency(code), decimals: 2 };
  const canNext = profile.name.trim().length > 0;

  const go = (s: 0 | 1) => { setStep(s); scroll.current?.scrollTo({ y: 0, animated: false }); };

  const create = async () => {
    if (!canNext || busy) return;
    setBusy(true);
    try {
      await createStore(profile.name.trim(), currency, { ...profile, name: profile.name.trim() });
      onCreated();
    } catch (e) {
      showAlert('Could not create shop', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  // Dev-only: one-tap demo store (products, staff, customers, sales).
  const seed = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await seedDemoData();
      onCreated();
    } catch (e) {
      showAlert('Could not load demo', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: insets.bottom + 40, flexGrow: 1 }}>
        <View style={o.stepRow}>
          {[0, 1].map((i) => (
            <View key={i} style={[o.stepBar, { backgroundColor: i <= step ? t.accent : t.line }]} />
          ))}
        </View>
        <Text style={{ color: t.muted, fontWeight: '700', fontSize: 12, letterSpacing: 0.6, marginTop: 10 }}>STEP {step + 1} OF 2</Text>

        {step === 0 ? (
          <>
            <Text style={[o.title, { color: t.fg, fontSize: 26, textAlign: 'left', marginTop: 6 }]}>Tell us about your shop</Text>
            <Text style={[o.sub, { color: t.muted, textAlign: 'left', marginTop: 6, marginBottom: 16, maxWidth: undefined }]}>
              This appears on your receipts. Only the name is required — everything else is optional and can be changed later.
            </Text>

            <ShopDetailsFields value={profile} onChange={patch} />

            <Text style={[o.label, { color: t.muted }]}>Currency</Text>
            <View style={o.row}>
              {CURRENCIES.map(({ code: c }) => {
                const on = code === c;
                return (
                  <Pressable key={c} onPress={() => setCode(c)} style={[o.pill, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.panel }]}>
                    <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700' }}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={() => go(1)} disabled={!canNext}
              style={[o.next, { backgroundColor: t.accent, opacity: canNext ? 1 : 0.5, marginTop: 32 }]}>
              <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={t.accentFg} style={{ marginLeft: 8 }} />
            </Pressable>

            {__DEV__ && (
              <Pressable onPress={seed} disabled={busy} style={{ marginTop: 16, alignSelf: 'center' }} hitSlop={10}>
                <Text style={{ color: t.muted, fontWeight: '600' }}>Load demo shop (dev)</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={[o.title, { color: t.fg, fontSize: 26, textAlign: 'left', marginTop: 6 }]}>Design your receipt</Text>
            <Text style={[o.sub, { color: t.muted, textAlign: 'left', marginTop: 6, marginBottom: 16, maxWidth: undefined }]}>
              Pick a paper size and color and add your own message. The preview updates as you go.
            </Text>

            <ReceiptPreview value={profile} currency={currency} />
            <ReceiptFields value={profile} onChange={patch} />

            <Pressable onPress={create} disabled={busy}
              style={[o.next, { backgroundColor: t.accent, opacity: busy ? 0.5 : 1, marginTop: 32 }]}>
              <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>{busy ? 'Creating…' : 'Create my shop'}</Text>
            </Pressable>
            <Pressable onPress={() => go(0)} disabled={busy} style={{ marginTop: 14, alignSelf: 'center' }} hitSlop={10}>
              <Text style={{ color: t.muted, fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Text style={{ color: t.faint, fontSize: 12, textAlign: 'center', marginTop: 14 }}>
              You can edit all of this later in More → Shop profile & receipts.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const o = StyleSheet.create({
  stepRow: { flexDirection: 'row', gap: 8 },
  stepBar: { flex: 1, height: 5, borderRadius: 3 },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  hero: { width: 148, height: 148, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  heroInner: { width: 108, height: 108, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 38 },
  sub: { fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 320 },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignSelf: 'stretch' },
  label: { fontSize: 13, fontWeight: '600', alignSelf: 'flex-start', marginTop: 16, marginBottom: 6 },
  input: { width: '100%', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
});
