import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { billingAvailable, getMonthlyPlan, purchaseMonthly, restorePurchases, devUnlock, type Plan } from '../src/subscription';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';
import { PrimaryButton } from '../src/pos/kit';

const BENEFITS = [
  { icon: 'cloud-done-outline', title: 'Automatic cloud backup', sub: 'Your shop is safe if the phone is lost or broken.' },
  { icon: 'sync-outline', title: 'Sync across devices', sub: 'Sell from two phones or a counter and back office at once.' },
  { icon: 'phone-portrait-outline', title: 'Restore on a new phone', sub: 'Sign in and pull everything down in seconds.' },
] as const;

export default function Paywall() {
  const t = useTheme();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const available = billingAvailable();

  useEffect(() => { if (available) getMonthlyPlan().then(setPlan); }, [available]);

  const priceLabel = plan ? `${plan.priceString}/month` : '$2/month';

  const subscribe = async () => {
    if (!plan || busy) return;
    setBusy(true);
    try {
      const ok = await purchaseMonthly(plan);
      if (ok) router.replace('/cloud-sync');
      else showAlert('Not completed', 'The purchase did not finish. You have not been charged.');
    } catch (e: any) {
      if (!e?.userCancelled) showAlert('Purchase failed', e?.message ?? 'Please try again.');
    } finally { setBusy(false); }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      if (ok) router.replace('/cloud-sync');
      else showAlert('Nothing to restore', 'No active cloud-sync subscription was found on this account.');
    } finally { setBusy(false); }
  };

  return (
    <Screen title="Go online" subtitle="Cloud backup & multi-device sync">
      <View style={[s.hero, { backgroundColor: t.accent }]}>
        <Ionicons name="cloud-outline" size={40} color={t.accentFg} />
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 24, marginTop: 10 }}>{priceLabel}</Text>
        <Text style={{ color: t.accentFg, opacity: 0.9, marginTop: 2 }}>Cancel anytime. Offline selling stays free.</Text>
      </View>

      <View style={{ marginTop: space.xl, gap: space.md }}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={s.benefit}>
            <View style={[s.bIcon, { backgroundColor: t.accentSoft }]}><Ionicons name={b.icon} size={20} color={t.accent} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{b.title}</Text>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>{b.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {available ? (
        <>
          <View style={{ marginTop: space.xxl }}>
            <PrimaryButton label={busy ? 'Please wait…' : `Subscribe · ${priceLabel}`} onPress={subscribe} busy={busy} disabled={!plan} />
          </View>
          <Pressable onPress={restore} disabled={busy} style={{ alignSelf: 'center', marginTop: space.lg }} hitSlop={10}>
            <Text style={{ color: t.accent, fontWeight: '700' }}>Restore purchase</Text>
          </Pressable>
        </>
      ) : (
        <View style={[s.note, { backgroundColor: t.accentSoft, marginTop: space.xxl }]}>
          <Ionicons name="construct-outline" size={18} color={t.accent} />
          <Text style={{ color: t.fg, marginLeft: 8, flex: 1, fontSize: 13 }}>
            Billing isn't set up on this build yet. Install RevenueCat, add your API key, and configure the $2/mo product to sell subscriptions. See HANDOFF.md.
          </Text>
        </View>
      )}

      {__DEV__ && (
        <Pressable onPress={() => { devUnlock(); router.replace('/cloud-sync'); }} style={{ alignSelf: 'center', marginTop: space.xl }} hitSlop={10}>
          <Text style={{ color: t.muted, fontWeight: '600' }}>Unlock for testing (dev)</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', borderRadius: radius.xl, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  benefit: { flexDirection: 'row', alignItems: 'center' },
  bIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: 14 },
});
