import { View, Text, Pressable, Modal, StyleSheet, Image } from 'react-native';
import { showAlert } from './alert';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../session';
import { useCheckoutUI } from '../checkoutUI';
import { useTheme } from '../theme';
import { Row, useMoney, PAYMENT_LABEL } from './ui';
import { printInvoice, shareInvoicePdf, type PrintableReceipt } from '../print';

export function ReceiptModal() {
  const t = useTheme();
  const store = useSession((s) => s.store);
  const staff = useSession((s) => s.staff);
  const receipt = useCheckoutUI((s) => s.receipt);
  const clear = useCheckoutUI((s) => s.clearReceipt);
  const money = useMoney();
  if (!store || !receipt) return null;

  const isCredit = receipt.paymentMethod === 'credit';
  const printable = (): PrintableReceipt => ({
    invoiceNo: receipt.invoiceNo, soldAt: receipt.soldAt, lines: receipt.lines,
    subtotal: receipt.subtotal, discountTotal: receipt.discountTotal, taxTotal: receipt.taxTotal,
    grandTotal: receipt.grandTotal, paymentLabel: PAYMENT_LABEL[receipt.paymentMethod] ?? receipt.paymentMethod,
    received: isCredit ? undefined : receipt.received, change: isCredit ? undefined : receipt.change,
    staffName: staff?.name,
  });
  const share = () => shareInvoicePdf(store, printable()).catch((e) => showAlert('Share failed', e instanceof Error ? e.message : String(e)));
  const print = () => printInvoice(store, printable()).catch((e) => showAlert('Print failed', e instanceof Error ? e.message : String(e)));

  return (
    <Modal visible animationType="fade" transparent onRequestClose={clear}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: t.panel }]}>
          {store.logo_uri && (store.receipt_show_logo ?? 1) === 1 ? (
            <View style={s.logoWrap}>
              <Image source={{ uri: store.logo_uri }} style={s.logo} resizeMode="contain" />
              <View style={[s.miniCheck, { backgroundColor: t.accent, borderColor: t.panel }]}><Ionicons name="checkmark" size={14} color={t.accentFg} /></View>
            </View>
          ) : (
            <View style={[s.check, { backgroundColor: t.accent }]}><Ionicons name="checkmark" size={30} color={t.accentFg} /></View>
          )}
          <Text style={{ color: t.fg, fontSize: 19, fontWeight: '800', textAlign: 'center' }}>Sale complete</Text>
          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>{store.name} · {receipt.invoiceNo}</Text>

          {receipt.lines.map((l, i) => (
            <Row key={i} label={`${l.name} ×${l.quantity}`} value={money(l.lineTotal)} />
          ))}
          <View style={[s.dashed, { borderColor: t.line }]} />
          <Row label="Subtotal" value={money(receipt.subtotal)} />
          {receipt.discountTotal > 0 && <Row label="Discount" value={`− ${money(receipt.discountTotal)}`} />}
          {receipt.taxTotal > 0 && <Row label="Tax" value={money(receipt.taxTotal)} />}
          <View style={s.totalRow}>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 18 }}>Total</Text>
            <Text style={{ color: t.fg, fontWeight: '800', fontSize: 18 }}>{money(receipt.grandTotal)}</Text>
          </View>
          <View style={[s.dashed, { borderColor: t.line }]} />
          {receipt.paymentMethod === 'credit' ? (
            <Row label="On account · Credit" value={money(receipt.grandTotal)} />
          ) : (
            <>
              <Row label={`Paid · ${PAYMENT_LABEL[receipt.paymentMethod]}`} value={money(receipt.received)} />
              <Row label="Change" value={money(receipt.change)} />
            </>
          )}

          <View style={s.actions}>
            <Pressable onPress={print} style={[s.ghost, { borderColor: t.line }]}>
              <Ionicons name="print-outline" size={18} color={t.fg} />
              <Text style={{ color: t.fg, fontWeight: '700', marginLeft: 6 }}>Print</Text>
            </Pressable>
            <Pressable onPress={share} style={[s.ghost, { borderColor: t.line }]}>
              <Ionicons name="share-outline" size={18} color={t.fg} />
              <Text style={{ color: t.fg, fontWeight: '700', marginLeft: 6 }}>Share</Text>
            </Pressable>
          </View>
          <Pressable onPress={clear} style={[s.primary, { backgroundColor: t.accent }]}>
            <Text style={{ color: t.accentFg, fontWeight: '800' }}>New sale</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 22, padding: 24, width: '88%' },
  logoWrap: { alignSelf: 'center', marginBottom: 12 },
  logo: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#fff' },
  miniCheck: { position: 'absolute', right: -6, bottom: -6, width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dashed: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ghost: { flex: 1, flexDirection: 'row', borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
});
