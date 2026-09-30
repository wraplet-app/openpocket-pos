import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { showAlert } from '../src/pos/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listStaff, deleteStaff, type Staff } from '../src/repos';
import { ROLE_LABEL } from '../src/roles';
import { useSession } from '../src/session';
import { Screen, IconButton, listProps } from '../src/pos/Screen';
import { EmptyState } from '../src/pos/kit';
import { useTheme, initials, tileColor, space, radius } from '../src/theme';

export default function StaffScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const me = useSession((s) => s.staff);
  const refreshStaffCount = useSession((s) => s.refreshStaffCount);
  const [staff, setStaff] = useState<Staff[]>([]);

  const reload = useCallback(() => {
    listStaff(store.id).then(setStaff);
    refreshStaffCount();
  }, [store.id]);
  useFocusEffect(reload);

  const confirmDelete = (m: Staff) => {
    showAlert('Remove staff', `Remove ${m.name}? Their past sales stay on record.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await deleteStaff(store.id, m.id); reload(); }
        catch (e) { showAlert('Cannot remove', e instanceof Error ? e.message : String(e)); }
      } },
    ]);
  };

  return (
    <Screen
      title="Staff & roles"
      scroll={false}
      right={<IconButton icon="person-add-outline" label="Add staff" filled onPress={() => router.push('/add-staff')} />}
    >
      <FlatList
        {...listProps}
        data={staff}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No staff yet" hint="Add accounts so each person signs in with their own PIN." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/add-staff', params: { id: item.id, name: item.name, role: item.role } })}
            style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.avatar, { backgroundColor: tileColor(item.id) }]}><Text style={{ color: '#fff', fontWeight: '800' }}>{initials(item.name)}</Text></View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>
                {item.name}{me?.id === item.id ? <Text style={{ color: t.accent }}>  · you</Text> : null}
              </Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{ROLE_LABEL[item.role]}</Text>
            </View>
            <Pressable onPress={() => confirmDelete(item)} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="trash-outline" size={20} color={t.danger} />
            </Pressable>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
