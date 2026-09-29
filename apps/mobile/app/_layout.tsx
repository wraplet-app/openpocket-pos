import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../src/db';
import { useSession, useLocked } from '../src/session';
import { Onboarding } from '../src/pos/Onboarding';
import { StaffLock } from '../src/pos/StaffLock';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSession = useSession((s) => s.load);
  const store = useSession((s) => s.store);
  const locked = useLocked();

  useEffect(() => {
    initDatabase()
      .then(() => loadSession())
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.danger, padding: 24, textAlign: 'center' }}>
          Database error:{'\n'}
          {error}
        </Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} size="large" />
        <Text style={{ color: t.muted, marginTop: 12 }}>Opening store…</Text>
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {!store ? (
        <Onboarding onCreated={loadSession} />
      ) : locked ? (
        <StaffLock />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
