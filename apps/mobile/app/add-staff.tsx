import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';
import { getStore, listStaff, createStaff, updateStaff, type Store } from '../src/repos';
import { ROLES, ROLE_LABEL, isValidPin, type Role } from '../src/roles';
import { useSession } from '../src/session';
import { useTheme, space, radius } from '../src/theme';

const ROLE_HINT: Record<Role, string> = {
  owner: 'Full access, including staff management',
  manager: 'Reports, products, returns, purchases — no staff management',
  cashier: 'Can sell and take payments only',
};

export default function AddStaff() {
  const t = useTheme();
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
    <Screen title={editing ? 'Edit staff' : 'New staff'}
      footer={<PrimaryButton label={editing ? 'Save changes' : 'Add staff'} onPress={save} busy={busy} disabled={!store} />}>
      <Text style={[st.label, { color: t.muted }]}>Name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Jordan Smith" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />

      <Text style={[st.label, { color: t.muted }]}>Role</Text>
      {firstEver && <Text style={{ color: t.muted, fontSize: 12, marginBottom: space.sm }}>The first account must be an owner.</Text>}
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
      <Text style={{ color: t.muted, fontSize: 13, marginTop: space.sm }}>{ROLE_HINT[role]}</Text>

      <Text style={[st.label, { color: t.muted }]}>{editing ? '4-digit PIN (leave blank to keep)' : '4-digit PIN'}</Text>
      <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 8 }]} />

      <Text style={[st.label, { color: t.muted }]}>Confirm PIN</Text>
      <TextInput value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={t.muted}
        style={[st.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 8 }]} />

      {err && <Text style={{ color: t.danger, marginTop: space.lg }}>{err}</Text>}
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  roleRow: { flexDirection: 'row', gap: space.sm },
  rolePill: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingVertical: 12 },
});
