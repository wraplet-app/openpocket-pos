import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { listCustomers, type Customer } from '../repos';
import { useSession } from '../session';
import { useMoney } from './ui';
import { useTheme, initials } from '../theme';

/** Modal to pick a customer for the current sale (or walk-in). */
export function CustomerPicker({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (c: Customer | null) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store);
  const money = useMoney();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => { if (store) listCustomers(store.id).then(setCustomers); }, [store?.id, visible]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(s) || (c.phone ?? '').includes(s));
  }, [customers, q]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.sheet, { backgroundColor: t.panel, paddingBottom: 20 + insets.bottom }]}>
          <View style={[s.grabber, { backgroundColor: t.line }]} />
          <View style={s.head}>
            <Text style={{ color: t.fg, fontSize: 19, fontWeight: '800' }}>Choose customer</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={t.muted} /></Pressable>
          </View>

          <View style={[s.search, { backgroundColor: t.surfaceAlt }]}>
            <Ionicons name="search-outline" size={18} color={t.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search name or phone" placeholderTextColor={t.muted}
              style={{ flex: 1, marginLeft: 8, color: t.fg, fontSize: 15, paddingVertical: 0 }} />
          </View>

          <Pressable onPress={() => { onPick(null); onClose(); }} style={[s.row, { borderColor: t.line }]}>
            <View style={[s.avatar, { backgroundColor: t.surfaceAlt }]}><Ionicons name="walk-outline" size={20} color={t.muted} /></View>
            <Text style={{ color: t.fg, fontWeight: '700', flex: 1, marginLeft: 12 }}>Walk-in (no customer)</Text>
          </Pressable>

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            style={{ maxHeight: 300 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onPick(item); onClose(); }} style={[s.row, { borderColor: t.line }]}>
                <View style={[s.avatar, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800' }}>{initials(item.name)}</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: t.fg, fontWeight: '700' }}>{item.name}</Text>
                  {item.phone ? <Text style={{ color: t.muted, fontSize: 12 }}>{item.phone}</Text> : null}
                </View>
                {item.balance > 0 && <Text style={{ color: t.danger, fontWeight: '700' }}>{money(item.balance as any)} due</Text>}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={{ color: t.muted, textAlign: 'center', paddingVertical: 20 }}>No customers yet.</Text>}
          />

          <Pressable onPress={() => { onClose(); router.push('/add-customer'); }} style={[s.addBtn, { borderColor: t.accent }]}>
            <Ionicons name="person-add-outline" size={18} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '800', marginLeft: 8 }}>New customer</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10, paddingBottom: 28 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 46, borderRadius: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14, marginTop: 12 },
});
