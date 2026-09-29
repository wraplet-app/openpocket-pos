import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { asMinor, type Minor } from '@openpocket/pos-core';
import { useCart } from '../cart';
import { useTheme } from '../theme';
import { useMoney } from './ui';
import { Thumb } from './Thumb';
import type { Product } from '../repos';

function ProductCardBase({ product }: { product: Product }) {
  const t = useTheme();
  const cart = useCart();
  const money = useMoney();
  const qty = cart.items[product.id]?.quantity ?? 0;
  const soldOut = product.stock <= qty;

  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: qty > 0 ? t.accent : t.line, boxShadow: t.shadow }]}>
      <Pressable onPress={() => cart.add(product)} disabled={soldOut} style={{ opacity: soldOut && qty === 0 ? 0.55 : 1 }}>
        <View style={s.tileWrap}>
          <Thumb uri={product.image_uri} name={product.name} style={s.tile} />
          {product.stock <= 5 && (
            <View style={[s.tag, { backgroundColor: product.stock === 0 ? t.danger : t.warn }]}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{product.stock === 0 ? 'OUT' : `${product.stock} LEFT`}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: t.fg, fontWeight: '700', marginTop: 10 }} numberOfLines={1}>{product.name}</Text>
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
          {product.stock} in stock{product.tax_bps ? ` · ${product.tax_bps / 100}% tax` : ''}
        </Text>
        <Text style={{ color: t.fg, fontWeight: '800', fontSize: 17, marginTop: 8 }}>{money(asMinor(product.selling_price))}</Text>
      </Pressable>

      {qty > 0 ? (
        <View style={[s.stepper, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
          <Pressable onPress={() => cart.setQty(product.id, qty - 1)} style={s.stepBtn} hitSlop={8}><Ionicons name="remove" size={20} color={t.fg} /></Pressable>
          <Text style={{ color: t.fg, fontWeight: '800', fontSize: 15 }}>{qty}</Text>
          <Pressable onPress={() => cart.add(product)} disabled={soldOut} style={[s.stepBtn, { opacity: soldOut ? 0.4 : 1 }]} hitSlop={8}><Ionicons name="add" size={20} color={t.fg} /></Pressable>
        </View>
      ) : (
        <Pressable onPress={() => cart.add(product)} disabled={soldOut} style={[s.addBtn, { backgroundColor: soldOut ? t.surfaceAlt : t.accentSoft }]}>
          <Ionicons name={soldOut ? 'close' : 'add'} size={16} color={soldOut ? t.muted : t.accent} />
          <Text style={{ color: soldOut ? t.muted : t.accent, fontWeight: '800', marginLeft: 4 }}>{soldOut ? 'Out of stock' : 'Add'}</Text>
        </Pressable>
      )}
    </View>
  );
}

export const ProductCard = memo(ProductCardBase);

const s = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: 20, padding: 12 },
  tileWrap: { position: 'relative' },
  tile: { width: '100%', height: 92, borderRadius: 14 },
  tag: { position: 'absolute', top: 8, right: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 12, paddingVertical: 10 },
  stepper: { marginTop: 10, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 4 },
  stepBtn: { width: 38, height: 32, alignItems: 'center', justifyContent: 'center' },
});
