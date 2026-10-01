import { useRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useTheme, space, radius, type as ty } from '../theme';

/**
 * Full-screen camera that reads one barcode and hands it back. Shared by any
 * screen that needs a quick scan (e.g. Add product), separate from the Scan tab
 * which runs a continuous sell/restock loop.
 */
export function ScanModal({ visible, onClose, onScan }: {
  visible: boolean; onClose: () => void; onScan: (code: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef(0);

  const handle = (r: BarcodeScanningResult) => {
    const now = Date.now();
    if (now - last.current < 1200) return; // ignore the rapid repeat scans the camera emits
    last.current = now;
    const code = r.data.trim();
    if (code) { onScan(code); onClose(); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.root}>
        {!permission || !permission.granted ? (
          <View style={[st.center, { backgroundColor: t.bg }]}>
            <View style={[st.icon, { backgroundColor: t.accentSoft }]}><Ionicons name="camera-outline" size={30} color={t.accent} /></View>
            <Text style={[ty.h2, { color: t.fg, marginTop: space.lg }]}>Camera access needed</Text>
            <Text style={[ty.body, { color: t.muted, textAlign: 'center', marginTop: space.sm, marginBottom: space.xl }]}>Allow the camera to scan a product barcode.</Text>
            <Pressable onPress={requestPermission} style={[st.grant, { backgroundColor: t.accent }]}>
              <Text style={{ color: t.accentFg, fontWeight: '800' }}>Grant camera access</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ marginTop: space.lg }} hitSlop={10}><Text style={{ color: t.muted }}>Cancel</Text></Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={handle}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr'] }}
            />
            <View style={[st.label, { top: insets.top + 70 }]} pointerEvents="none">
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Scan a barcode</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>Point the camera at a product barcode</Text>
            </View>
            <View style={st.reticle} pointerEvents="none" />
            <Pressable onPress={onClose} hitSlop={12} style={[st.close, { top: insets.top + 10 }]}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  icon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  grant: { borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 14 },
  label: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  reticle: { position: 'absolute', alignSelf: 'center', top: '34%', width: '70%', aspectRatio: 1.4, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: radius.lg },
  close: { position: 'absolute', right: space.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
