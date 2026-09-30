import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSyncState, saveSyncConfig, disconnectSync, syncNow, restoreFromCloud, isConfigured, type SyncState } from '../src/sync';
import { newId } from '../src/id';
import { useSession } from '../src/session';
import { useTheme, space, radius } from '../src/theme';
import { Screen } from '../src/pos/Screen';

export default function CloudSync() {
  const t = useTheme();
  const router = useRouter();
  const reload = useSession((s) => s.load);
  const [state, setState] = useState<SyncState | null>(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getSyncState().then((s) => {
      setState(s);
      setUrl(s.server_url ?? '');
      setToken(s.token ?? '');
    });
  }, []);
  useFocusEffect(refresh);

  const connected = state ? isConfigured(state) : false;

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { Alert.alert('Sync error', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); refresh(); }
  };

  const connectAndSync = () => run('sync', async () => {
    if (!url.trim() || !token.trim()) { Alert.alert('Missing details', 'Enter both the server URL and a token.'); return; }
    await saveSyncConfig(url, token);
    const r = await syncNow();
    Alert.alert('Synced', `Cloud sync is on. Last synced just now.`);
  });

  const sync = () => run('sync', async () => { await syncNow(); });

  const disconnect = () => Alert.alert('Turn off cloud sync?', 'Your data stays on this device; it just stops syncing.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Turn off', style: 'destructive', onPress: () => run('off', async () => { await disconnectSync(); }) },
  ]);

  const restore = () => {
    if (!url.trim() || !token.trim()) { Alert.alert('Missing details', 'Enter the server URL and the token from your other device.'); return; }
    Alert.alert('Restore from cloud', 'This REPLACES all data on this device with the store from the cloud. Use this on a new or spare device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace & pull', style: 'destructive', onPress: () => run('restore', async () => {
        const n = await restoreFromCloud(url, token);
        await reload();
        router.replace('/');
        Alert.alert('Device linked', `Pulled ${n} records from the cloud.`);
      }) },
    ]);
  };

  const footer = connected ? (
    <Pressable onPress={sync} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
      {busy === 'sync' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="sync-outline" size={18} color={t.accentFg} />}
      <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</Text>
    </Pressable>
  ) : (
    <Pressable onPress={connectAndSync} disabled={!!busy} accessibilityRole="button" style={[s.primary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}>
      {busy === 'sync' ? <ActivityIndicator color={t.accentFg} /> : <Ionicons name="cloud-upload-outline" size={18} color={t.accentFg} />}
      <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16, marginLeft: space.sm }}>{busy === 'sync' ? 'Connecting…' : 'Connect & sync this store'}</Text>
    </Pressable>
  );

  return (
    <Screen title="Cloud sync" footer={footer}>
      <View style={[s.status, { backgroundColor: connected ? t.accent : t.panel, borderColor: t.line }]}>
        <Ionicons name={connected ? 'cloud-done-outline' : 'cloud-offline-outline'} size={26} color={connected ? t.accentFg : t.muted} />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={{ color: connected ? t.accentFg : t.fg, fontWeight: '800', fontSize: 16 }}>{connected ? 'Connected' : 'Not connected'}</Text>
          <Text style={{ color: connected ? t.accentFg : t.muted, opacity: connected ? 0.9 : 1, fontSize: 12, marginTop: 2 }}>
            {connected ? (state?.last_synced_at ? `Last synced ${new Date(state.last_synced_at).toLocaleString()}` : 'Not synced yet') : 'Back up and sync this store across devices'}
          </Text>
        </View>
      </View>

      <Text style={[s.label, { color: t.muted }]}>Server URL</Text>
      <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
        placeholder="https://openpocket-sync.<you>.workers.dev" placeholderTextColor={t.muted}
        style={[s.input, { color: t.fg, borderColor: t.line, backgroundColor: t.panel }]} />

      <Text style={[s.label, { color: t.muted }]}>Store token</Text>
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
        Use the same URL and token on every device for this shop. Keep the token private — anyone with it can read your store's data.
      </Text>

      {connected ? (
        <Pressable onPress={disconnect} disabled={!!busy} style={[s.secondary, { borderColor: t.line }]}>
          <Text style={{ color: t.danger, fontWeight: '700' }}>Turn off cloud sync</Text>
        </Pressable>
      ) : (
        <>
          <View style={[s.divider, { borderColor: t.line }]} />
          <Text style={[s.label, { color: t.muted, marginTop: 0 }]}>New or spare device</Text>
          <Text style={{ color: t.muted, fontSize: 13, marginBottom: space.md }}>
            Already set up on another phone? Enter the same URL and token above, then pull the store down here.
          </Text>
          <Pressable onPress={restore} disabled={!!busy} style={[s.secondary, { borderColor: t.accent }]}>
            {busy === 'restore' ? <ActivityIndicator color={t.accent} /> : <Ionicons name="cloud-download-outline" size={18} color={t.accent} />}
            <Text style={{ color: t.accent, fontWeight: '700', marginLeft: space.sm }}>{busy === 'restore' ? 'Pulling…' : 'Restore this device from cloud'}</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  label: { fontSize: 13, fontWeight: '600', marginTop: space.lg, marginBottom: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontSize: 16 },
  gen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: 14 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52, paddingHorizontal: space.xl },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingVertical: 15, marginTop: space.xl, borderWidth: 1 },
  divider: { borderTopWidth: 1, marginTop: space.xl, marginBottom: space.lg },
});
