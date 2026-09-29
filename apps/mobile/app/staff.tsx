import { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listStaff, deleteStaff, type Staff } from '../src/repos';
import { ROLE_LABEL } from '../src/roles';
import { useSession } from '../src/session';
import { useTheme, initials, tileColor } from '../src/theme';

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
    Alert.alert('Remove staff', `Remove ${m.name}? Their past sales stay on record.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await deleteStaff(store.id, m.id); reload(); }
        catch (e) { Alert.alert('Cannot remove', e instanceof Error ? e.message : String(e)); }
      } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 10 }}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={24} color={t.fg} /></Pressable>
        <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800' }}>Staff & roles</Text>
        <Pressable onPress={() => router.push('/add-staff')} style={[s.add, { backgroundColor: t.accent }]}>
          <Ionicons name="person-add-outline" size={20} color={t.accentFg} />
        </Pressable>
      </View>

      <FlatList
        data={staff}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <View style={[s.emptyIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name="people-outline" size={28} color={t.muted} /></View>
            <Text style={{ color: t.fg, fontWeight: '700', marginTop: 14 }}>No staff yet</Text>
            <Text style={{ color: t.muted, marginTop: 4, textAlign: 'center' }}>Add accounts so each person signs in{'\n'}with their own PIN.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/add-staff', params: { id: item.id, name: item.name, role: item.role } })}
            style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.avatar, { backgroundColor: tileColor(item.id) }]}><Text style={{ color: '#fff', fontWeight: '800' }}>{initials(item.name)}</Text></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
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
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
