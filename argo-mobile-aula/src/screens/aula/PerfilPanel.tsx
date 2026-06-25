import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { IconInput } from '../../components/IconInput';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScaledText } from '../../components/ScaledText';
import { ScreenBody } from '../../components/ScreenBody';
import { SurfaceCard } from '../../components/SurfaceCard';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { actualizarEmpresa, buscarEmpresas } from '../../api/aulaApi';
import type { RootStackParamList } from '../../navigation/types';
import { radius, space } from '../../theme/spacing';

export default function PerfilPanel() {
  const { state, signOut, updateEmpresa } = useAuth();
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const c = useTheme();
  const [editEmpresa, setEditEmpresa] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<{ _id: string; nombre: string; identificacion: string }[]>([]);
  const [loading, setLoading] = useState(false);

  if (state.status !== 'signedIn') return null;
  const { user } = state;
  const inicial = (user.nombreCompleto || user.email).charAt(0).toUpperCase();

  async function onBuscarEmpresa(q: string) {
    setBusqueda(q);
    if (q.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    try {
      setSugerencias(await buscarEmpresas(q.trim()));
    } catch {
      setSugerencias([]);
    }
  }

  async function onSeleccionarEmpresa(e: { _id: string; nombre: string }) {
    setLoading(true);
    try {
      const res = await actualizarEmpresa(e._id);
      updateEmpresa(res.empresaId, res.empresaNombre);
      setEditEmpresa(false);
      Alert.alert('Perfil', `Empresa vinculada: ${res.empresaNombre}`);
    } catch (err) {
      Alert.alert('Perfil', err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function onQuitarEmpresa() {
    try {
      await actualizarEmpresa(null);
      updateEmpresa(null, null);
    } catch {
      /* ignore */
    }
  }

  return (
    <ScreenBody>
      <SurfaceCard tint={c.accentSoft} accentLeft={c.primary}>
        <View style={styles.profileHead}>
          <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
            <ScaledText baseSize={28} style={{ color: c.primary, fontWeight: '800' }}>
              {inicial}
            </ScaledText>
          </View>
          <View style={{ flex: 1 }}>
            <ScaledText baseSize={20} style={{ color: c.text, fontWeight: '800' }}>
              {user.nombreCompleto}
            </ScaledText>
            <InfoChip icon="mail-outline" text={user.email} color={c.primary} bg={c.accentSoft} />
            <InfoChip icon="card-outline" text={`Doc. ${user.numDoc}`} color={c.violet} bg={c.violetSoft} />
          </View>
        </View>

        <View style={[styles.empresa, { borderColor: `${c.accent}55` }]}>
          <View style={styles.empresaTitle}>
            <Ionicons name="business-outline" size={18} color={c.accent} />
            <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700', marginLeft: 6 }}>
              Empresa
            </ScaledText>
          </View>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 6 }}>
            {user.empresaNombre ?? 'Sin empresa vinculada'}
          </ScaledText>
          {!editEmpresa ? (
            <View style={styles.empBtns}>
              <PrimaryButton label="Cambiar" variant="secondary" onPress={() => setEditEmpresa(true)} icon="create-outline" />
              {user.empresaId ? (
                <PrimaryButton label="Quitar" variant="ghost" onPress={() => void onQuitarEmpresa()} icon="close-circle-outline" />
              ) : null}
            </View>
          ) : (
            <>
              <IconInput value={busqueda} onChangeText={onBuscarEmpresa} placeholder="Buscar empresa…" icon="search-outline" />
              {sugerencias.map((e) => (
                <Pressable key={e._id} onPress={() => void onSeleccionarEmpresa(e)} style={[styles.sug, { backgroundColor: c.foroSoft }]}>
                  <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>
                    {e.nombre}
                  </ScaledText>
                  <ScaledText baseSize={12} style={{ color: c.textSoft }}>
                    {e.identificacion}
                  </ScaledText>
                </Pressable>
              ))}
              <PrimaryButton label="Cancelar" variant="ghost" onPress={() => setEditEmpresa(false)} loading={loading} />
            </>
          )}
        </View>
      </SurfaceCard>

      <View style={{ marginTop: space.lg, gap: space.md }}>
        <PrimaryButton
          label="Catálogo público"
          variant="secondary"
          onPress={() => nav.navigate('Catalogo')}
          icon="compass-outline"
          fullWidth
        />
        <PrimaryButton
          label="Cerrar sesión"
          variant="danger"
          onPress={() => void signOut()}
          icon="log-out-outline"
          fullWidth
        />
      </View>
    </ScreenBody>
  );
}

function InfoChip({
  icon,
  text,
  color,
  bg,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={14} color={color} />
      <ScaledText baseSize={12} style={{ color, marginLeft: 6, fontWeight: '600', flex: 1 }} numberOfLines={1}>
        {text}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHead: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  empresa: { borderTopWidth: 1, marginTop: space.lg, paddingTop: space.md },
  empresaTitle: { flexDirection: 'row', alignItems: 'center' },
  empBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' },
  sug: { padding: space.md, borderRadius: radius.md, marginTop: space.sm },
});
