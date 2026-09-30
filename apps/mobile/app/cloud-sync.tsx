import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Share, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getSyncState, saveSyncConfig, disconnectSync, syncNow, restoreFromCloud, isConfigured,
  hasHostedSync, turnOnCloudBackup, linkDeviceByCode, formatCode, type SyncState,
} from '../src/sync';
import { hasCloudSync } from '../src/subscription';
import { newId } from '../src/id';
import { useSession } from '../src/session';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';

export default function CloudSync() {
  const t = useTheme();
  const router = useRouter();
  const reload = useSession((s) => s.load);
  const hosted = hasHostedSync();
  const [state, setState] = useState<SyncState | null>(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // Cloud sync is a paid feature — no subscription → paywall.
    hasCloudSync().then((ok) => { if (!ok) router.replace('/paywall'); });
    getSyncState().then((s) => {
      setState(s);
      setUrl(s.server_url ?? '');
      setToken(s.token ?? '');
    });
  }, []);
  useFocusEffect(refresh);

  const connected = state ? isConfigured(state) : false;
  const shopCode = state?.token ? formatCode(state.token) : '';

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { showAlert('Sync error', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); refresh(); }
  };

  // --- one-tap hosted actions ---
  const turnOn = () => run('on', async () => {
    await turnOnCloudBackup();
    showAlert('Cloud backup is on', 'Your shop is backed up. Use your shop code to add another device.');
  });
  const sync = () => run('sync', async () => { await syncNow(); });
  const shareCode = async () => {
    if (!shopCode) return;
    try { await Share.share({ message: `Add this device to my OpenPocket shop with code: ${shopCode}` }); } catch { /* dismissed */ }
  };
  const link = () => {
    if (!linkCode.trim()) { showAlert('Enter a shop code', 'Paste the code shown on your other device.'); return; }
    showAlert('Link this device?', 'This REPLACES all data on this device with the shop from the cloud. Use it on a new or spare phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace & link', style: 'destructive', onPress: () => run('link', async () => {
        const n = await linkDeviceByCode(linkCode);
        await reload(); router.replace('/');
        showAlert('Device linked', `Pulled ${n} records for this shop.`);
      }) },
    ]);
  };

  // --- manual / self-host actions ---
  const connectAndSync = () => run('sync', async () => {
    if (!url.trim() || !token.trim()) { showAlert('Missing details', 'Enter both the server URL and a token.'); return; }
    await saveSyncConfig(url, token);
    await syncNow();
    showAlert('Synced', 'Cloud sync is on. Last synced just now.');
  });
  const restore = () => {
    if (!url.trim() || !token.trim()) { showAlert('Missing details', 'Enter the server URL and the token from your other device.'); return; }
    showAlert('Restore from cloud', 'This REPLACES all data on this device with the store from the cloud.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace & pull', style: 'destructive', onPress: () => run('restore', async () => {
        const n = await restoreFromCloud(url, token);
        await reload(); router.replace('/');
        showAlert('Device linked', `Pulled ${n} records from the cloud.`);
      }) },
    ]);
  };

  const disconnect = () => showAlert('Turn off cloud backup?', 'Your data stays on this device; it just stops syncing.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Turn off', style: 'destructive', onPress: () => run('off', async () => { await disconnectSync(); }) },
  ]);

  // Footer: the single primary action for the current state.
  const footer = (() => {
    if (connected) {
      return (
        <Pressable onPress={sync} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
          {busy === 'sync' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="sync-outline" size={18} color={t.accentFg} />}
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</Text>
        </Pressable>
      );
    }
    if (hosted) {
      return (
        <Pressable onPress={turnOn} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
          {busy === 'on' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-upload-outline" size={18} color={t.accentFg} />}
          <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'on' ? 'Turning on…' : 'Turn on cloud backup'}</Text>
        </Pressable>
      );
    }
    return (
      <Pressable onPress={connectAndSync} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
        {busy === 'sync' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-upload-outline" size={18} color={t.accentFg} />}
        <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'sync' ? 'Connecting…' : 'Connect & sync this store'}</Text>
      </Pressable>
    );
  })();

  return (
    <Screen title="Cloud backup" footer={footer}>
      {/* Status */}
      <View style={[s.status, { backgroundColor: connected ? t.accent : t.panel, borderColor: t.line }]}>
        <Ionicons name={connected ? 'cloud-done-outline' : 'cloud-offline-outline'} size={26} color={connected ? t.accentFg : t.muted} />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={{ color: connected ? t.accentFg : t.fg, fontWeight: '800', fontSize: 16 }}>{connected ? 'Backed up' : 'Not backed up'}</Text>
          <Text style={{ color: connected ? t.accentFg : t.muted, opacity: connected ? 0.9 : 1, fontSize: 12, marginTop: 2 }}>
            {connected ? (state?.last_synced_at ? `Last synced ${new Date(state.last_synced_at).toLocaleString()}` : 'Not synced yet') : 'Keep this shop safe and synced across your devices'}
          </Text>
        </View>
      </View>

      {/* CONNECTED (hosted): shop code to add devices */}
      {connected && hosted && shopCode ? (
        <>
          <Text style={[s.label, { color: t.muted }]}>YOUR SHOP CODE</Text>
          <View style={[s.codeCard, { borderColor: t.accent, backgroundColor: t.accentSoft }]}>
            <Text selectable style={[s.code, { color: t.fg }]}>{shopCode}</Text>
            <Pressable onPress={shareCode} style={[s.share, { backgroundColor: t.accent }]}>
              <Ionicons name="share-outline" size={16} color={t.accentFg} />
              <Text style={{ color: t.accentFg, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Share</Text>
            </Pressable>
          </View>
          <Text style={{ color: t.faint, fontSize: 12, marginTop: 6 }}>
            On another phone, open Cloud backup, tap “Add this device to a shop” and enter this code. Keep it private — anyone with it can read this shop's data.
          </Text>
          <Pressable onPress={disconnect} disabled={!!busy} style={[s.secondary, { borderColor: t.line }]}>
            <Text style={{ color: t.danger, fontWeight: '700' }}>Turn off cloud backup</Text>
          </Pressable>
        </>
      ) : null}

      {/* NOT CONNECTED (hosted): explainer + link-with-code */}
      {!connected && hosted ? (
        <>
          <View style={[s.benefit, { borderColor: t.line }]}>
            {[
              ['cloud-done-outline', 'Automatic backup', 'Your shop is safe if the phone is lost or broken.'],
              ['phone-portrait-outline', 'Across devices', 'Sell from two phones or a back office at once.'],
            ].map(([icon, title, sub]) => (
              <View key={title} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                <View style={[s.bIcon, { backgroundColor: t.accentSoft }]}><Ionicons name={icon as never} size={18} color={t.accent} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: t.fg, fontWeight: '700' }}>{title}</Text>
                  <Text style={{ color: t.muted, fontSize: 12.5 }}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable onPress={() => setShowLink((v) => !v)} style={[s.disclosure, { borderColor: t.line }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={t.accent} />
            <Text style={{ color: t.fg, fontWeight: '700', flex: 1, marginLeft: 10 }}>Add this device to a shop</Text>
            <Ionicons name={showLink ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
          </Pressable>
          {showLink ? (
            <View style={{ marginTop: space.md }}>
              <Text style={{ color: t.muted, fontSize: 13, marginBottom: space.sm }}>Already selling on another phone? Enter that shop's code to pull it down here.</Text>
              <TextInput value={linkCode} onChangeText={setLinkCode} autoCapitalize="characters" autoCorrect={false}
                placeholder="XXXX-XXXX-XXXX-XXXX" placeholderTextColor={t.muted}
                style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel, letterSpacing: 1 }]} />
              <Pressable onPress={link} disabled={!!busy} style={[s.secondary, { borderColor: t.accent, marginTop: space.md }]}>
                {busy === 'link' ? <ActivityIndicator color={t.accent} /> : <Ionicons name="cloud-download-outline" size={18} color={t.accent} />}
                <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>{busy === 'link' ? 'Linking…' : 'Link this device'}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {/* ADVANCED / self-host, or the whole manual flow when no hosted backend */}
      {(!hosted || showAdvanced) && !connected ? (
        <>
          {hosted ? <View style={[s.divider, { borderColor: t.line }]} /> : null}
          <Text style={[s.label, { color: t.muted, marginTop: 0 }]}>{hosted ? 'CUSTOM SERVER' : 'SERVER URL'}</Text>
          <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
            placeholder="https://openpocket-sync.<you>.workers.dev" placeholderTextColor={t.muted}
            style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
          <Text style={[s.label, { color: t.muted }]}>STORE TOKEN</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false}
              placeholder="a shared secret for your store" placeholderTextColor={t.muted}
              style={[s.input, { flex: 1, color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />
            <Pressable onPress={() => setToken(newId() + newId())} style={[s.gen, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="key-outline" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Generate</Text>
            </Pressable>
          </View>
          <Text style={{ color: t.faint, fontSize: 11, marginTop: 6 }}>
            Use the same URL and token on every device for this shop. Keep the token private.
          </Text>
          <Pressable onPress={restore} disabled={!!busy} style={[s.secondary, { borderColor: t.accent }]}>
            {busy === 'restore' ? <ActivityIndicator color={t.accent} /> : <Ionicons name="cloud-download-outline" size={18} color={t.accent} />}
            <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>{busy === 'restore' ? 'Pulling…' : 'Restore this device from a custom server'}</Text>
          </Pressable>
        </>
      ) : null}

      {/* Toggle to reveal the custom-server option when a hosted backend exists */}
      {hosted && !connected ? (
        <Pressable onPress={() => setShowAdvanced((v) => !v)} style={{ alignSelf: 'center', marginTop: space.xl }} hitSlop={10}>
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13 }}>{showAdvanced ? 'Hide custom server' : 'Use a custom server instead'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  gen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: 14 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52, paddingHorizontal: space.xl },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingVertical: 15, marginTop: space.xl, borderWidth: 1 },
  divider: { borderTopWidth: 1, marginTop: space.xl, marginBottom: space.lg },
  codeCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg },
  code: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  share: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9 },
  benefit: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  bIcon: { width: 36, height: 36, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
  disclosure: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
});
