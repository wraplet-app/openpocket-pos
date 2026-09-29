import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../src/session';
import { exportProducts, exportSales, importProducts, exportFullBackup, restoreFullBackup } from '../src/backup';
import { useTheme, type Theme } from '../src/theme';

export default function DataScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const reload = useSession((s) => s.load);
  const [busy, setBusy] = useState<string | null>(null);

  const confirmRestore = () => {
    Alert.alert('Restore from backup', 'This replaces ALL current data — products, sales, customers and staff — with the backup file. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Choose file', style: 'destructive', onPress: () => run('rs', async () => {
        const r = await restoreFullBackup();
        if (!r) return;
        await reload();
        router.replace('/');
        Alert.alert('Restore complete', `Restored ${r.rows} records across ${r.tables} tables.`);
      }) },
    ]);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } catch (e) { Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10 }}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={24} color={t.fg} /></Pressable>
        <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800' }}>Backup & CSV</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={[s.section, { color: t.muted }]}>EXPORT</Text>
      <Group t={t}>
        <Row t={t} icon="cube-outline" title="Export products" subtitle="Share your catalog as a CSV file"
          busy={busy === 'ep'} onPress={() => run('ep', async () => {
            const n = await exportProducts(store);
            if (n === 0) Alert.alert('Nothing to export', 'You have no products yet.');
          })} />
        <Row t={t} icon="receipt-outline" title="Export sales" subtitle="Share all sales line items as CSV" last
          busy={busy === 'es'} onPress={() => run('es', async () => {
            const n = await exportSales(store);
            if (n === 0) Alert.alert('Nothing to export', 'You have no sales yet.');
          })} />
      </Group>

      <Text style={[s.section, { color: t.muted }]}>IMPORT</Text>
      <Group t={t}>
        <Row t={t} icon="download-outline" title="Import products" subtitle="Upload a CSV to add or update products" last
          busy={busy === 'ip'} onPress={() => run('ip', async () => {
            const r = await importProducts(store);
            if (r) Alert.alert('Import complete', `${r.created} added · ${r.updated} updated · ${r.skipped} skipped.`);
          })} />
      </Group>

      <Text style={[s.section, { color: t.muted }]}>FULL BACKUP</Text>
      <Group t={t}>
        <Row t={t} icon="cloud-upload-outline" title="Back up everything" subtitle="Save a complete snapshot as a .json file"
          busy={busy === 'fb'} onPress={() => run('fb', async () => {
            const n = await exportFullBackup(store);
            if (n === 0) Alert.alert('Nothing to back up', 'Your store has no data yet.');
          })} />
        <Row t={t} icon="cloud-download-outline" title="Restore from backup" subtitle="Replace all data with a backup file" last
          busy={busy === 'rs'} onPress={confirmRestore} />
      </Group>

      <View style={[s.note, { backgroundColor: t.accentSoft }]}>
        <Ionicons name="information-circle-outline" size={18} color={t.accent} />
        <Text style={{ color: t.fg, marginLeft: 8, flex: 1, fontSize: 13 }}>
          Import matches by barcode: existing products are updated (name, prices, tax), new ones are created with their opening stock. Columns: name, barcode, selling_price, cost_price, tax_percent, stock.
        </Text>
      </View>
    </ScrollView>
  );
}

function Group({ children, t }: { children: React.ReactNode; t: Theme }) {
  return <View style={[s.group, { backgroundColor: t.panel, borderColor: t.line }]}>{children}</View>;
}

function Row({ t, icon, title, subtitle, onPress, busy, last }: {
  t: Theme; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void; busy?: boolean; last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[s.row, !last && { borderBottomWidth: 1, borderColor: t.line }]}>
      <View style={[s.icon, { backgroundColor: t.accentSoft }]}><Ionicons name={icon} size={20} color={t.accent} /></View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: t.fg, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {busy ? <ActivityIndicator color={t.accent} /> : <Ionicons name="chevron-forward" size={18} color={t.muted} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', borderRadius: 14, padding: 14, marginTop: 24 },
});
