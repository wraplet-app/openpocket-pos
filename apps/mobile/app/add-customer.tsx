import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getStore, createCustomer, type Store } from '../src/repos';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';

export default function AddCustomer() {
  const t = useTheme();
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
      await createCustomer({ storeId: store.id, name, phone, email, address, notes });
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
    <Screen title="New customer" footer={<PrimaryButton label="Save customer" onPress={save} busy={busy} disabled={!store} />}>
      {field('Name', name, setName, { ph: 'e.g. Jordan Smith' })}
      {field('Phone', phone, setPhone, { kb: 'phone-pad', ph: 'optional' })}
      {field('Email', email, setEmail, { kb: 'email-address', ph: 'optional' })}
      {field('Address', address, setAddress, { ph: 'optional' })}
      {field('Notes', notes, setNotes, { ph: 'optional', multi: true })}

      {err && <Text style={{ color: t.danger, marginTop: space.lg }}>{err}</Text>}
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
});
