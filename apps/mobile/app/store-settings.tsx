import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession, useRole, currencyOf } from '../src/session';
import { can } from '../src/roles';
import { profileOf, updateStoreProfile, type StoreProfile } from '../src/repos';
import { ShopDetailsFields, ReceiptFields, ReceiptPreview } from '../src/pos/StoreProfileForm';
import { useTheme, space, type as ty } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';

/** More → Shop profile & receipts. Owner-only; edits the same fields as onboarding. */
export default function StoreSettings() {
  const t = useTheme();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const reload = useSession((s) => s.load);
  const role = useRole();
  const [profile, setProfile] = useState<StoreProfile>(() => profileOf(store));
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<StoreProfile>) => setProfile((prev) => ({ ...prev, ...p }));

  if (!can(role, 'shop')) {
    return (
      <Screen title="Shop profile" scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
          <Ionicons name="lock-closed-outline" size={32} color={t.muted} />
          <Text style={{ color: t.fg, fontWeight: '700', marginTop: space.md }}>Owner access only</Text>
          <Text style={{ color: t.muted, marginTop: space.xs, textAlign: 'center' }}>Ask the shop owner to change the shop profile or receipt design.</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: space.xl }}><Text style={{ color: t.accent, fontWeight: '700' }}>Go back</Text></Pressable>
        </View>
      </Screen>
    );
  }

  const save = async () => {
    if (busy) return;
    if (!profile.name.trim()) { showAlert('Shop name is required'); return; }
    setBusy(true);
    try {
      await updateStoreProfile(store.id, profile);
      await reload();
      router.back();
    } catch (e) {
      showAlert('Could not save', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Screen title="Shop profile" footer={<PrimaryButton label="Save changes" onPress={save} busy={busy} />}>
      <Text style={[ty.h2, { color: t.fg, marginBottom: space.xs }]}>Your shop</Text>
      <ShopDetailsFields value={profile} onChange={patch} />

      <Text style={[ty.h2, { color: t.fg, marginTop: space.xxl, marginBottom: space.xs }]}>Receipt design</Text>
      <View style={{ marginTop: space.md }}><ReceiptPreview value={profile} currency={currencyOf(store)} /></View>
      <ReceiptFields value={profile} onChange={patch} />
    </Screen>
  );
}
