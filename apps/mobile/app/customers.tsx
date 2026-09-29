import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { asMinor, type Minor } from '@openpocket/pos-core';
import { listCustomers, outstandingCredit, type Customer, type OutstandingTotal } from '../src/repos';
import { useSession } from '../src/session';
import { useMoney } from '../src/pos/ui';
import { useTheme, initials } from '../src/theme';

export default function Customers() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const store = useSession((s) => s.store)!;
  const money = useMoney();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingTotal>({ totalOwed: 0, customersWithBalance: 0 });
  const [q, setQ] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);

  useFocusEffect(useCallback(() => {
    listCustomers(store.id).then(setCustomers);
    outstandingCredit(store.id).then(setOutstanding);
  }, [store.id]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return customers.filter((c) =>
      (!onlyDebt || c.balance > 0) &&
      (!s || c.name.toLowerCase().includes(s) || (c.phone ?? '').includes(s)));
  }, [customers, q, onlyDebt]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 10 }}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={t.fg} />
        </Pressable>
        <Text style={{ color: t.fg, fontSize: 22, fontWeight: '800' }}>Customers</Text>
        <Pressable onPress={() => router.push('/add-customer')} style={[s.add, { backgroundColor: t.accent }]}>
          <Ionicons name="person-add-outline" size={20} color={t.accentFg} />
        </Pressable>
      </View>

      {outstanding.totalOwed > 0 && (
        <View style={[s.summary, { backgroundColor: t.accent }]}>
          <View>
            <Text style={{ color: t.accentFg, opacity: 0.9, fontSize: 12 }}>Outstanding credit</Text>
            <Text style={{ color: t.accentFg, fontSize: 24, fontWeight: '800', marginTop: 2 }}>{money(asMinor(outstanding.totalOwed))}</Text>
          </View>
          <Text style={{ color: t.accentFg, opacity: 0.9 }}>{outstanding.customersWithBalance} customer{outstanding.customersWithBalance === 1 ? '' : 's'}</Text>
        </View>
      )}

      <View style={[s.search, { backgroundColor: t.panel, borderColor: t.line }]}>
        <Ionicons name="search-outline" size={18} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search name or phone" placeholderTextColor={t.muted}
          style={{ flex: 1, marginLeft: 8, color: t.fg, fontSize: 15, paddingVertical: 0 }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 }}>
        {[{ k: false, label: 'All' }, { k: true, label: 'Owes credit' }].map(({ k, label }) => {
          const on = onlyDebt === k;
          return (
            <Pressable key={label} onPress={() => setOnlyDebt(k)}
              style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.panel }}>
              <Text style={{ color: on ? t.accent : t.fg, fontWeight: '600', fontSize: 13 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <View style={[s.emptyIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name="people-outline" size={28} color={t.muted} /></View>
            <Text style={{ color: t.fg, fontWeight: '700', marginTop: 14 }}>No customers yet</Text>
            <Text style={{ color: t.muted, marginTop: 4 }}>Add regulars to track credit.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/customer/${item.id}`)} style={[s.row, { backgroundColor: t.panel, borderColor: t.line }]}>
            <View style={[s.avatar, { backgroundColor: t.accent }]}><Text style={{ color: t.accentFg, fontWeight: '800' }}>{initials(item.name)}</Text></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: t.fg, fontWeight: '700' }}>{item.name}</Text>
              {item.phone ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{item.phone}</Text> : null}
            </View>
            {item.balance > 0
              ? <Text style={{ color: t.danger, fontWeight: '800' }}>{money(item.balance as Minor)}</Text>
              : <Text style={{ color: t.muted, fontSize: 12 }}>Settled</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 14, height: 48, borderRadius: 14, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12 },
  avatar: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
