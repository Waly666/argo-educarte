import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import type { MensajeForo } from '../api/types';
import { useForo } from '../hooks/useForo';
import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { fmtFecha } from '../utils/cursoUtils';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type Props = {
  token: string | null;
  idPrograma: string;
  nombreCurso?: string;
};

export function ForoChat({ token, idPrograma, nombreCurso = '' }: Props) {
  const c = useTheme();
  const { mensajes, conectado, cargando, error, enviarMensaje } = useForo({
    token,
    idPrograma,
    nombrePrograma: nombreCurso,
  });
  const [texto, setTexto] = React.useState('');

  function onEnviar() {
    if (!texto.trim()) return;
    enviarMensaje(texto);
    setTexto('');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.card, borderColor: `${c.accent}55` }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.statusPill, { backgroundColor: conectado ? c.okSoft : c.warnSoft }]}>
        <View style={[styles.dot, { backgroundColor: conectado ? c.ok : c.warn }]} />
        <ScaledText baseSize={12} style={{ color: c.text, fontWeight: '600' }}>
          {conectado ? 'En línea' : 'Reconectando…'}
          {cargando ? ' · cargando…' : ''}
        </ScaledText>
      </View>
      {error ? (
        <ScaledText baseSize={13} style={{ color: c.danger, marginBottom: space.sm, paddingHorizontal: space.sm }}>
          {error}
        </ScaledText>
      ) : null}
      <FlatList
        data={mensajes}
        keyExtractor={(m) => m._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MensajeRow msg={item} />}
        ListEmptyComponent={
          !cargando ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={c.textSoft} />
              <ScaledText baseSize={14} style={{ color: c.textSoft, textAlign: 'center', marginTop: space.sm }}>
                Sé el primero en escribir en este foro.
              </ScaledText>
            </View>
          ) : null
        }
      />
      <View style={[styles.composer, shadow.sm, { borderColor: c.border, backgroundColor: c.inputBg }]}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje…"
          placeholderTextColor="#94a3b8"
          style={[styles.input, { color: c.text }]}
          multiline
        />
        <Pressable onPress={onEnviar} style={styles.sendWrap}>
          <LinearGradient colors={[c.primary, c.accent]} style={styles.send}>
            <Ionicons name="send" size={18} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MensajeRow({ msg }: { msg: MensajeForo }) {
  const c = useTheme();
  const esStaff = msg.autorTipo === 'instructor' || msg.autorTipo === 'admin';
  return (
    <View style={[styles.msg, { backgroundColor: esStaff ? c.accentSoft : c.bg, borderColor: c.borderLight }]}>
      <View style={styles.msgHead}>
        <View style={styles.authorRow}>
          <View style={[styles.avatar, { backgroundColor: esStaff ? c.primary : c.border }]}>
            <ScaledText baseSize={11} style={{ color: esStaff ? '#fff' : c.text, fontWeight: '700' }}>
              {msg.autorNombre.charAt(0).toUpperCase()}
            </ScaledText>
          </View>
          <View>
            <ScaledText baseSize={13} style={{ color: c.text, fontWeight: '700' }}>
              {msg.autorNombre}
              {esStaff ? ' · Instructor' : ''}
            </ScaledText>
            <ScaledText baseSize={10} style={{ color: c.textSoft }}>
              {fmtFecha(msg.createdAt)}
            </ScaledText>
          </View>
        </View>
      </View>
      <ScaledText baseSize={14} style={{ color: c.text, marginTop: space.sm, lineHeight: 20 }}>
        {msg.texto}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    margin: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  list: { paddingHorizontal: space.md, paddingBottom: space.sm, flexGrow: 1 },
  empty: { alignItems: 'center', padding: space.xxl },
  msg: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  msgHead: { flexDirection: 'row', justifyContent: 'space-between' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    padding: space.sm,
    gap: space.sm,
  },
  input: { flex: 1, fontSize: 15, maxHeight: 100, padding: space.sm },
  sendWrap: { borderRadius: 22, overflow: 'hidden' },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
