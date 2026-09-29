import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { CartBar } from '../../src/pos/CartBar';
import { CheckoutSheet } from '../../src/pos/CheckoutSheet';
import { ReceiptModal } from '../../src/pos/ReceiptModal';
import { QuickSaleModal } from '../../src/pos/QuickSaleModal';

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabBarHeight = 60 + insets.bottom;

  const tab = (name: keyof typeof Ionicons.glyphMap, focusedName: keyof typeof Ionicons.glyphMap) =>
    ({ focused, color }: { focused: boolean; color: string }) => (
      <Ionicons name={focused ? focusedName : name} size={23} color={color} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.faint,
          tabBarStyle: {
            backgroundColor: t.panel,
            borderTopColor: t.line,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: insets.bottom + 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tab('home-outline', 'home') }} />
        <Tabs.Screen name="products" options={{ title: 'Products', tabBarIcon: tab('cube-outline', 'cube') }} />
        <Tabs.Screen
          name="newsale"
          options={{
            title: '',
            tabBarIcon: () => (
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: -22, borderWidth: 4, borderColor: t.panel, boxShadow: t.shadowStrong }}>
                <Ionicons name="barcode-outline" size={28} color={t.accentFg} />
              </View>
            ),
          }}
          listeners={{ tabPress: (e) => { e.preventDefault(); router.push('/scan'); } }}
        />
        <Tabs.Screen name="sales" options={{ title: 'Sales', tabBarIcon: tab('receipt-outline', 'receipt') }} />
        <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: tab('ellipsis-horizontal', 'ellipsis-horizontal') }} />
      </Tabs>

      <CartBar bottom={tabBarHeight + 10} />
      <CheckoutSheet />
      <ReceiptModal />
      <QuickSaleModal />
    </View>
  );
}
