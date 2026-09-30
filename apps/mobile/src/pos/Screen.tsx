/**
 * Screen scaffolding shared by every screen so headers, safe areas and scrolling
 * behave the same everywhere:
 *
 *   <Screen title="Customers" right={...}>     fixed header + back button, scrolling body
 *   <Screen title="..." scroll={false}>        fixed header, body manages its own list
 *   <Screen title="..." footer={<Button/>}>    pinned footer above the gesture bar / keyboard
 *   <TabHeader title="Products">...</TabHeader> large fixed header for the bottom-tab screens
 *
 * The header never scrolls away; only the body moves. Insets come from the
 * SafeAreaProvider (status bar on top, gesture / navigation bar on the bottom).
 */
import { type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme, space, type as ty, HEADER_HEIGHT, TAB_BAR_HEIGHT } from '../theme';

/** Round 40px icon button used in headers. */
export function IconButton({ icon, onPress, label, tint, filled }: {
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; tint?: string; filled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: filled ? t.accent : t.panel, borderColor: filled ? t.accent : t.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={tint ?? (filled ? t.accentFg : t.fg)} />
    </Pressable>
  );
}

/** Fixed header for pushed screens: back button, title, optional right actions. */
export function Header({ title, subtitle, back = true, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[s.header, { paddingTop: insets.top, backgroundColor: t.bg, borderBottomColor: t.line }]}>
      <View style={s.headerRow}>
        {back ? <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
        <View style={s.headerText}>
          <Text style={[ty.h1, { color: t.fg }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[ty.small, { color: t.muted }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={s.headerRight}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Scroll defaults: smooth, no scrollbar flicker, taps work while the keyboard is up. */
export const scrollProps = {
  showsVerticalScrollIndicator: false,
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: (Platform.OS === 'ios' ? 'interactive' : 'on-drag') as 'interactive' | 'on-drag',
  scrollEventThrottle: 16,
};

/** Virtualisation defaults for long lists (products, sales, customers). */
export const listProps = {
  ...scrollProps,
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 7,
  removeClippedSubviews: Platform.OS === 'android',
};

export function Screen({ title, subtitle, back = true, right, children, scroll = true, footer, contentStyle }: {
  title: string; subtitle?: string; back?: boolean; right?: ReactNode; children: ReactNode; scroll?: boolean;
  footer?: ReactNode; contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <Header title={title} subtitle={subtitle} back={back} right={right} />
      {/* Android runs edge-to-edge, where the OS no longer resizes for the keyboard,
          so KAV must handle it on both platforms. The offset is the fixed header
          above this view, otherwise padding is over-applied and leaves a gap. */}
      <KeyboardAvoidingView style={s.flex} behavior="padding" keyboardVerticalOffset={insets.top + HEADER_HEIGHT}>
        {scroll ? (
          <ScrollView
            {...scrollProps}
            style={s.flex}
            contentContainerStyle={[{ padding: space.lg, paddingBottom: footer ? space.xl : insets.bottom + space.xxl }, contentStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={s.flex}>{children}</View>
        )}
        {footer ? (
          <View style={[s.footer, { backgroundColor: t.bg, borderTopColor: t.line, paddingBottom: insets.bottom + space.md }]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
      {/* Opaque strip behind the gesture / navigation bar so scrolling content never shows through it. */}
      {!footer && insets.bottom > 0 ? (
        <View pointerEvents="none" style={[s.bottomInset, { height: insets.bottom, backgroundColor: t.bg }]} />
      ) : null}
    </View>
  );
}

/**
 * Fixed top area for the bottom-tab screens: large title, optional right actions and
 * any pinned controls (search, chips) passed as children. The body below is the
 * screen's own scrolling list.
 */
export function TabHeader({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.tabHeader, { paddingTop: insets.top + space.sm, backgroundColor: t.bg, borderBottomColor: t.line }]}>
      <View style={s.tabTitleRow}>
        <View style={s.headerText}>
          {subtitle ? <Text style={[ty.small, { color: t.muted }]} numberOfLines={1}>{subtitle}</Text> : null}
          <Text style={[ty.title, { color: t.fg }]} numberOfLines={1}>{title}</Text>
        </View>
        {right ? <View style={s.headerRight}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

/** Bottom padding a tab screen's list needs to clear the tab bar and the floating cart bar. */
export function useTabListInset(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + 88;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  bottomInset: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  headerText: { flex: 1, justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.md },
  tabHeader: { paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  tabTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, marginBottom: space.xs },
});
