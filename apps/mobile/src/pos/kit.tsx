/** Small shared controls: search field, filter chips, empty state, primary button. */
import { type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, space, radius, type as ty } from '../theme';

export function SearchField({ value, onChangeText, placeholder, right }: {
  value: string; onChangeText: (v: string) => void; placeholder: string; right?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[s.search, { backgroundColor: t.panel, borderColor: t.line }]}>
      <Ionicons name="search-outline" size={18} color={t.muted} />
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.muted}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search"
        style={[s.searchInput, { color: t.fg }]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={t.faint} />
        </Pressable>
      ) : right}
    </View>
  );
}

export function Chip({ label, on, onPress, count }: { label: string; on: boolean; onPress: () => void; count?: number }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[s.chip, { borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.panel }]}>
      <Text style={{ color: on ? t.accentFg : t.fg, fontWeight: '600', fontSize: 13.5 }}>{label}</Text>
      {count != null ? <Text style={{ color: on ? t.accentFg : t.muted, fontWeight: '700', fontSize: 12, opacity: on ? 0.85 : 1 }}>{count}</Text> : null}
    </Pressable>
  );
}

/** One horizontally scrolling row of chips (bleeds to the screen edges). */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}
      contentContainerStyle={s.chipRow} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function ChipDivider() {
  const t = useTheme();
  return <View style={{ width: 1, height: 20, backgroundColor: t.line, alignSelf: 'center', marginHorizontal: 2 }} />;
}

export function EmptyState({ icon, title, hint, action }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; hint?: string; action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name={icon} size={30} color={t.muted} /></View>
      <Text style={[ty.h2, { color: t.fg, marginTop: space.lg, textAlign: 'center' }]}>{title}</Text>
      {hint ? <Text style={[ty.body, { color: t.muted, marginTop: space.xs, textAlign: 'center' }]}>{hint}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} style={[s.emptyBtn, { backgroundColor: t.accent }]}>
          <Text style={{ color: t.accentFg, fontWeight: '800' }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, busy, icon }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const t = useTheme();
  const off = disabled || busy;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button"
      style={({ pressed }) => [s.primary, { backgroundColor: t.accent, opacity: off ? 0.5 : pressed ? 0.85 : 1 }]}>
      {icon ? <Ionicons name={icon} size={18} color={t.accentFg} style={{ marginRight: 8 }} /> : null}
      <Text style={{ color: t.accentFg, fontWeight: '800', fontSize: 16 }}>{busy ? 'Please wait…' : label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 46, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  chipScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -space.lg },
  chipRow: { gap: space.sm, paddingHorizontal: space.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  emptyIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyBtn: { marginTop: space.xl, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 26 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, height: 52, paddingHorizontal: space.xl },
});
