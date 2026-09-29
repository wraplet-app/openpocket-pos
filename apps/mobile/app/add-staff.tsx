import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStore, listStaff, createStaff, updateStaff, type Store } from '../src/repos';
import { ROLES, ROLE_LABEL, isValidPin, type Role } from '../src/roles';
import { useSession } from '../src/session';
import { useTheme } from '../src/theme';

const ROLE_HINT: Record<Role, string> = {
  owner: 'Full access, including staff management',
  manager: 'Reports, products, returns, purchases — no staff management',
  cashier: 'Can sell and take payments only',
};

export default function AddStaff() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string; role?: Role }>();
  const editing = !!params.id;
  const refreshStaffCount = useSession((s) => s.refreshStaffCount);
  const signIn = useSession((s) => s.signIn);

  const [store, setStore] = useState<Store | null>(null);
  const [firstEver, setFirstEver] = useState(false);
  const [name, setName] = useState(params.name ?? '');
  const [role, setRole] = useState<Role>(params.role ?? 'cashier');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getStore().then(async (st) => {
      setStore(st);
      if (st && !editing) {
        const existing = await listStaff(st.id);
        if (existing.length === 0) { setFirstEver(true); setRole('owner'); }
      }
    });
  }, []);

  const save = async () => {
    if (!store || busy) return;
    setErr(null);
    if (!name.trim()) { setErr('Name is required'); return; }
    // PIN required on create; optional on edit (blank = keep existing).
    const changingPin = pin.length > 0 || confirm.length > 0 || !editing;
    if (changingPin) {
      if (!isValidPin(pin)) { setErr('PIN must be exactly 4 digits'); return; }
      if (pin !== confirm) { setErr('PINs do not match'); return; }
    }
    setBusy(true);
    try {
      if (editing) {
        await updateStaff({ id: params.id!, name, role, pin: pin || undefined });
        await refreshStaffCount();
      } else {
        const id = await createStaff({ storeId: store.id, name, role, pin });
        await refreshStaffCount();
        // Adding the very first account would otherwise flip the app into the
        // PIN lock and unmount this screen (a GO_BACK-on-nothing warning). Sign
        // the new owner in so setup continues seamlessly.
        if (firstEver) signIn({ id, name: name.trim(), role, created_at: Date.now() });
      }
      router.back();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, backgroundColor: t.bg, flexGrow: 1 }}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ color: t.fg, fontSize: 18, fontWeight: '800' }}>{editing ? 'Edit staff' : 'New staff'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <Text style={[st.label, { color: t.muted }]}>NAME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Ali Khan" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />

      <Text style={[st.label, { color: t.muted }]}>ROLE</Text>
      {firstEver && <Text style={{ color: t.muted, fontSize: 12, marginBottom: 8 }}>The first account must be an owner.</Text>}
      <View style={st.roleRow}>
        {ROLES.map((r) => {
          const on = role === r;
          const disabled = firstEver && r !== 'owner';
          return (
            <Pressable key={r} onPress={() => !disabled && setRole(r)} disabled={disabled}
              style={[st.rolePill, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.panel, opacity: disabled ? 0.4 : 1 }]}>
              <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '700' }}>{ROLE_LABEL[r]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: 8 }}>{ROLE_HINT[role]}</Text>

      <Text style={[st.label, { color: t.muted }]}>{editing ? '4-DIGIT PIN (leave blank to keep)' : '4-DIGIT PIN'}</Text>
      <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 8 }]} />

      <Text style={[st.label, { color: t.muted }]}>CONFIRM PIN</Text>
      <TextInput value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 8 }]} />

      {err && <Text style={{ color: t.danger, marginTop: 14 }}>{err}</Text>}

      <Pressable onPress={save} disabled={busy || !store} style={[st.primary, { backgroundColor: t.accent, opacity: busy || !store ? 0.5 : 1 }]}>
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 17 }}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add staff'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  roleRow: { flexDirection: 'row', gap: 8 },
  rolePill: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  primary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
});
