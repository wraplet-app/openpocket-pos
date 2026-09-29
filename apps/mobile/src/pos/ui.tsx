import { View, Text } from 'react-native';
import { format, type Minor } from '@openpocket/pos-core';
import { useSession, currencyOf } from '../session';
import { useTheme } from '../theme';

/** Hook returning a money formatter bound to the current store's currency. */
export function useMoney(): (m: Minor) => string {
  const store = useSession((s) => s.store);
  return (m: Minor) => (store ? format(m, currencyOf(store)) : '');
}

export const PAYMENT_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', bank: 'Transfer', credit: 'Credit' };

/** Label/value row used in the checkout sheet and receipt. */
export function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ color: t.muted }}>{label}</Text>
      <Text style={{ color: t.fg, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
