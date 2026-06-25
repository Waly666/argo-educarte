import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CAJERO_AZUL_REY } from '../config/appBranding';
import { ScaledText } from './ScaledText';
import type { SoportePago } from '../utils/pago';

export type CedulaCaptura = SoportePago;

type Props = {
  visible: boolean;
  onClose: () => void;
  onCaptura: (img: CedulaCaptura) => void;
};

/** Proporción ancho/alto cédula CO (~86×54 mm) en landscape. */
const CARD_ASPECT = 1.586;

function calcularMarco(
  horizontal: boolean,
  screenW: number,
  areaH: number,
): { w: number; h: number } {
  const maxW = screenW - 32;
  const maxH = areaH * 0.62;
  const aspect = horizontal ? CARD_ASPECT : 1 / CARD_ASPECT;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

function Corner({ style }: { style: object }) {
  return <View style={[styles.corner, style]} />;
}

function MarcoFrente({ w, h }: { w: number; h: number }) {
  return (
    <View style={[styles.marco, { width: w, height: h }]}>
      <Corner style={[styles.cornerTL, styles.cornerBase]} />
      <Corner style={[styles.cornerTR, styles.cornerBase, { borderLeftWidth: 0, borderRightWidth: 4 }]} />
      <Corner style={[styles.cornerBL, styles.cornerBase, { borderTopWidth: 0, borderBottomWidth: 4 }]} />
      <Corner
        style={[
          styles.cornerBR,
          styles.cornerBase,
          { borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: 4, borderRightWidth: 4 },
        ]}
      />
      <View style={styles.labelWrap}>
        <ScaledText baseSize={11} style={styles.label}>
          FRENTE DE LA CÉDULA
        </ScaledText>
      </View>
    </View>
  );
}

export function CedulaCameraModal({ visible, onClose, onCaptura }: Props) {
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);
  const [perm, requestPerm] = useCameraPermissions();
  const [horizontal, setHorizontal] = useState(false);
  const [capturando, setCapturando] = useState(false);

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const areaH = screenH - insets.top - insets.bottom - 160;
  const { w: frameW, h: frameH } = calcularMarco(horizontal, screenW, areaH);
  const dimTop = Math.max(0, (areaH - frameH) / 2);
  const dimSide = Math.max(0, (screenW - frameW) / 2);

  async function tomarFoto() {
    if (!camRef.current || capturando) return;
    setCapturando(true);
    try {
      const foto = await camRef.current.takePictureAsync({ quality: 0.92, skipProcessing: false });
      if (!foto?.uri) return;
      onCaptura({
        uri: foto.uri,
        name: `cedula-frente-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      onClose();
    } finally {
      setCapturando(false);
    }
  }

  if (!visible) return null;

  if (!perm?.granted) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
        <View style={[styles.permiso, { paddingTop: insets.top + 24 }]}>
          <Ionicons name="camera-outline" size={48} color="#fff" />
          <ScaledText baseSize={16} style={styles.permisoTxt}>
            Permita la cámara para fotografiar el frente de la cédula.
          </ScaledText>
          <Pressable style={styles.permBtn} onPress={() => void requestPerm()}>
            <ScaledText baseSize={15} style={{ color: '#fff', fontWeight: '700' }}>
              Activar cámara
            </ScaledText>
          </Pressable>
          <Pressable onPress={onClose} style={{ marginTop: 16 }}>
            <ScaledText baseSize={14} style={{ color: '#94a3b8' }}>
              Cancelar
            </ScaledText>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <ScaledText baseSize={16} style={styles.headerTitle}>
            Frente de la cédula
          </ScaledText>
          <View style={styles.headerBtn} />
        </View>

        <View style={[styles.modoRow, { top: insets.top + 56 }]}>
          <Pressable
            onPress={() => setHorizontal(false)}
            style={[styles.modoChip, !horizontal && styles.modoChipOn]}
          >
            <Ionicons name="phone-portrait-outline" size={16} color={!horizontal ? '#0f172a' : '#e2e8f0'} />
            <ScaledText baseSize={12} style={{ color: !horizontal ? '#0f172a' : '#e2e8f0', fontWeight: '700' }}>
              Vertical
            </ScaledText>
          </Pressable>
          <Pressable
            onPress={() => setHorizontal(true)}
            style={[styles.modoChip, horizontal && styles.modoChipOn]}
          >
            <Ionicons name="phone-landscape-outline" size={16} color={horizontal ? '#0f172a' : '#e2e8f0'} />
            <ScaledText baseSize={12} style={{ color: horizontal ? '#0f172a' : '#e2e8f0', fontWeight: '700' }}>
              Horizontal
            </ScaledText>
          </Pressable>
        </View>

        <View style={[styles.overlayArea, { paddingTop: insets.top + 100, paddingBottom: 140 }]}>
          <View style={{ height: dimTop, width: '100%', backgroundColor: 'rgba(0,0,0,0.58)' }} />
          <View style={{ flexDirection: 'row', height: frameH }}>
            <View style={{ width: dimSide, backgroundColor: 'rgba(0,0,0,0.58)' }} />
            <MarcoFrente w={frameW} h={frameH} />
            <View style={{ width: dimSide, backgroundColor: 'rgba(0,0,0,0.58)' }} />
          </View>
          <View style={{ flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.58)' }} />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <ScaledText baseSize={13} style={styles.hint}>
            Solo el frente. Ubique número, nombres y apellidos dentro del recuadro.
          </ScaledText>
          <Pressable
            onPress={() => void tomarFoto()}
            disabled={capturando}
            style={[styles.shutter, capturando && { opacity: 0.6 }]}
          >
            {capturando ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const GREEN = '#4ade80';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 10,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontWeight: '700' },
  modoRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10,
  },
  modoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  modoChipOn: { backgroundColor: GREEN, borderColor: GREEN },
  overlayArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  marco: {
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  corner: { position: 'absolute', width: 28, height: 28 },
  cornerBase: {
    borderColor: GREEN,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTL: { top: -2, left: -2, borderTopLeftRadius: 12 },
  cornerTR: { top: -2, right: -2, borderTopRightRadius: 12 },
  cornerBL: { bottom: -2, left: -2, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: -2, right: -2, borderBottomRightRadius: 12 },
  labelWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  label: {
    color: GREEN,
    fontWeight: '800',
    letterSpacing: 0.8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    gap: 14,
    paddingHorizontal: 20,
  },
  hint: { color: '#e2e8f0', textAlign: 'center', lineHeight: 18 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  permiso: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permisoTxt: { color: '#e2e8f0', textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: CAJERO_AZUL_REY,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
});
