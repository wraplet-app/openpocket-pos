/**
 * A themed, in-app replacement for React Native's Alert.alert, which draws an
 * OS-native dialog that ignores our theme. Same call signature, so it's a
 * drop-in: showAlert(title, message?, buttons?). Mount <AlertHost/> once at the
 * app root; showAlert() can then be called from anywhere (event handlers too).
 */
import { create } from 'zustand';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, space, radius } from '../theme';

export type AlertButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type AlertData = { title: string; message?: string; buttons: AlertButton[] };

interface AlertStore { current: AlertData | null; show: (a: AlertData) => void; dismiss: () => void }
const useAlertStore = create<AlertStore>((set) => ({
  current: null,
  show: (a) => set({ current: a }),
  dismiss: () => set({ current: null }),
}));

/** Themed drop-in for Alert.alert. With no buttons, shows a single "OK". */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  useAlertStore.getState().show({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
}

export function AlertHost() {
  const t = useTheme();
  const current = useAlertStore((s) => s.current);
  const dismiss = useAlertStore((s) => s.dismiss);
  if (!current) return null;

  const { title, message, buttons } = current;
  const run = (b: AlertButton) => { dismiss(); b.onPress?.(); };
  // Two buttons sit side by side (cancel left, action right); otherwise stack.
  const row = buttons.length === 2;
  const cancel = buttons.find((b) => b.style === 'cancel');
  const onBackdrop = () => { dismiss(); cancel?.onPress?.(); };

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onBackdrop}>
      <Pressable style={s.backdrop} onPress={onBackdrop}>
        <Pressable style={[s.card, { backgroundColor: t.panel, borderColor: t.line }]} onPress={() => {}}>
          <Text style={[s.title, { color: t.fg }]}>{title}</Text>
          {message ? <Text style={[s.msg, { color: t.muted }]}>{message}</Text> : null}
          <View style={[s.actions, { borderTopColor: t.line }, row && s.actionsRow]}>
            {buttons.map((b, i) => {
              const color = b.style === 'destructive' ? t.danger : b.style === 'cancel' ? t.muted : t.accent;
              return (
                <Pressable
                  key={`${b.text}-${i}`} onPress={() => run(b)} android_ripple={{ color: t.accentSoft }}
                  style={[s.btn, row && { flex: 1 }, i > 0 && (row ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.line } : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line })]}
                >
                  <Text style={{ color, fontWeight: b.style === 'cancel' ? '600' : '800', fontSize: 16, textAlign: 'center' }}>{b.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 360, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  title: { fontSize: 18, fontWeight: '800', paddingHorizontal: space.xl, paddingTop: space.xl, marginBottom: space.xs },
  msg: { fontSize: 15, lineHeight: 21, paddingHorizontal: space.xl },
  actions: { marginTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  actionsRow: { flexDirection: 'row' },
  btn: { paddingVertical: 15, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
});
