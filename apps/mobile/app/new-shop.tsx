import { useState } from 'react';
import { Text, TextInput, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createStore } from '../src/repos';
import { useSession } from '../src/session';
import { CURRENCIES, localeForCurrency } from '../src/branding';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';

export default function NewShop() {
  const t = useTheme();
  const router = useRouter();
  const reload = useSession((s) => s.load);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [code, setCode] = useState('USD');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createStore(name.trim(), { code, locale: localeForCurrency(code), decimals: 2 }, { tagline: tagline.trim() });
      await reload();          // new shop is now the active one (created as current)
      router.replace('/');     // fresh shop has no staff yet → straight to Home
    } catch { setBusy(false); }
  };

  return (
    <Screen title="Add a shop" subtitle="A separate shop on this device" footer={<PrimaryButton label="Create shop" onPress={create} busy={busy} disabled={!name.trim()} />}>
      <Text style={[st.label, { color: t.muted }]}>SHOP NAME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Corner Fresh Market" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />

      <Text style={[st.label, { color: t.muted }]}>TAGLINE (OPTIONAL)</Text>
      <TextInput value={tagline} onChangeText={setTagline} placeholder="e.g. Fresh groceries, fair prices" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />

      <Text style={[st.label, { color: t.muted }]}>CURRENCY</Text>
      <View style={st.pills}>
        {CURRENCIES.map((c) => {
          const on = code === c.code;
          return (
            <Pressable key={c.code} onPress={() => setCode(c.code)} style={[st.pill, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.panel }]}>
              <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700' }}>{c.code}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.faint, fontSize: 12, marginTop: space.md }}>You can add products, staff and receipt details to this shop after it's created.</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
});
