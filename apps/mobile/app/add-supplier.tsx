import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStore, createSupplier, type Store } from '../src/repos';
import { useTheme } from '../src/theme';

export default function AddSupplier() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getStore().then(setStore); }, []);

  const save = async () => {
    if (!store || busy) return;
    if (!name.trim()) { setErr('Name is required'); return; }
    setBusy(true);
    try {
      await createSupplier({ storeId: store.id, name, phone, email, address, notes });
      router.back();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  const field = (label: string, value: string, set: (v: string) => void, opts?: { kb?: 'phone-pad' | 'email-address'; ph?: string; multi?: boolean }) => (
    <>
      <Text style={[st.label, { color: t.muted }]}>{label}</Text>
      <TextInput value={value} onChangeText={set} placeholder={opts?.ph} placeholderTextColor={t.muted}
        keyboardType={opts?.kb} multiline={opts?.multi} autoCapitalize={opts?.kb === 'email-address' ? 'none' : 'sentences'}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, height: opts?.multi ? 88 : undefined, textAlignVertical: opts?.multi ? 'top' : 'center' }]} />
    </>
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, backgroundColor: t.bg, flexGrow: 1 }}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ color: t.fg, fontSize: 18, fontWeight: '800' }}>New supplier</Text>
        <View style={{ width: 60 }} />
      </View>

      {field('Name', name, setName, { ph: 'e.g. Metro Wholesale' })}
      {field('Phone', phone, setPhone, { kb: 'phone-pad', ph: 'optional' })}
      {field('Email', email, setEmail, { kb: 'email-address', ph: 'optional' })}
      {field('Address', address, setAddress, { ph: 'optional' })}
      {field('Notes', notes, setNotes, { ph: 'optional', multi: true })}

      {err && <Text style={{ color: t.danger, marginTop: 14 }}>{err}</Text>}

      <Pressable onPress={save} disabled={busy || !store} style={[st.primary, { backgroundColor: t.accent, opacity: busy || !store ? 0.5 : 1 }]}>
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>{busy ? 'Saving…' : 'Save supplier'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 13, marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
});
