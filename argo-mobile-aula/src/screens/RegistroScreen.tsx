import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import {
  buscarAlumnoRegistro,
  buscarEmpresasPublico,
  registro,
  registroConfirmar,
  registroReenviarCodigo,
  registroSolicitar,
} from '../api/aulaApi';
import {
  buscarMunicipios,
  fetchDepartamentos,
  fetchGeneros,
  fetchMunicipioPorCodigo,
  fetchMunicipios,
  fetchTiposDoc,
  type DeptoDivipola,
  type MunicipioDivipola,
} from '../api/catalogosApi';
import { ArgoDateInput } from '../components/ArgoDateInput';
import { IconInput } from '../components/IconInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScaledText } from '../components/ScaledText';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAuth } from '../context/AuthContext';
import { usePortalConfig } from '../context/PortalConfigContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import { space } from '../theme/spacing';
import { FormSelect, type SelectOption } from '../components/FormSelect';
import {
  catEtiqueta,
  catValor,
  etiquetaGenero,
  GENEROS_FALLBACK,
  TIPOS_DOC_FALLBACK,
} from '../utils/catalogoHelpers';
import { ymdToday } from '../utils/argoDateHelpers';

type Paso = 'formulario' | 'codigo';

type RegistroForm = {
  email: string;
  password: string;
  tipoDoc: string;
  numDoc: string;
  expedida: string;
  apellido1: string;
  apellido2: string;
  nombre1: string;
  nombre2: string;
  celular: string;
  direccion: string;
  genero: string;
  fechaNac: string;
  codMunicipio: string;
  munOrigen: string;
  empresaId: string | null;
  empresaNombre: string | null;
};

const FORM_INICIAL: RegistroForm = {
  email: '',
  password: '',
  tipoDoc: '1',
  numDoc: '',
  expedida: '',
  apellido1: '',
  apellido2: '',
  nombre1: '',
  nombre2: '',
  celular: '',
  direccion: '',
  genero: '',
  fechaNac: '',
  codMunicipio: '',
  munOrigen: '',
  empresaId: null,
  empresaNombre: null,
};

function FieldLabel({ children }: { children: string }) {
  const c = useTheme();
  return (
    <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
      {children}
    </ScaledText>
  );
}

function SectionTitle({ children }: { children: string }) {
  const c = useTheme();
  return (
    <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '800', marginTop: 8, marginBottom: 10 }}>
      {children}
    </ScaledText>
  );
}

export default function RegistroScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { applyAuthResponse } = useAuth();
  const { config } = usePortalConfig();
  const c = useTheme();

  const [paso, setPaso] = useState<Paso>('formulario');
  const [form, setForm] = useState<RegistroForm>(FORM_INICIAL);
  const [deptoExp, setDeptoExp] = useState('');
  const [codMunicipioExp, setCodMunicipioExp] = useState('');
  const [deptoOrigen, setDeptoOrigen] = useState('');
  const [codMunicipioOrigen, setCodMunicipioOrigen] = useState('');

  const [tiposDoc, setTiposDoc] = useState<Record<string, unknown>[]>(TIPOS_DOC_FALLBACK);
  const [generos, setGeneros] = useState<Record<string, unknown>[]>(GENEROS_FALLBACK);
  const [departamentos, setDepartamentos] = useState<DeptoDivipola[]>([]);
  const [municipiosExp, setMunicipiosExp] = useState<MunicipioDivipola[]>([]);
  const [municipiosOrigen, setMunicipiosOrigen] = useState<MunicipioDivipola[]>([]);

  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [alumnoEnArgo, setAlumnoEnArgo] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const [pendingId, setPendingId] = useState('');
  const [emailEnmascarado, setEmailEnmascarado] = useState('');
  const [codigoVerificacion, setCodigoVerificacion] = useState('');
  const [reenviando, setReenviando] = useState(false);

  const [empresaBusq, setEmpresaBusq] = useState('');
  const [empresaSugs, setEmpresaSugs] = useState<{ _id: string; nombre: string; identificacion: string }[]>([]);
  const [empresaCargando, setEmpresaCargando] = useState(false);

  const patch = useCallback((partial: Partial<RegistroForm>) => {
    setForm((f) => ({ ...f, ...partial }));
  }, []);

  useEffect(() => {
    void fetchTiposDoc()
      .then((rows) => setTiposDoc(rows?.length ? rows : TIPOS_DOC_FALLBACK))
      .catch(() => setTiposDoc(TIPOS_DOC_FALLBACK));
    void fetchGeneros()
      .then((rows) => setGeneros(rows?.length ? rows : GENEROS_FALLBACK))
      .catch(() => setGeneros(GENEROS_FALLBACK));
    void fetchDepartamentos()
      .then(setDepartamentos)
      .catch(() => setDepartamentos([]));
  }, []);

  const tiposDocOpts: SelectOption[] = useMemo(
    () => tiposDoc.map((t) => ({ value: catValor(t), label: catEtiqueta(t) })),
    [tiposDoc],
  );
  const generoOpts: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Seleccione…' }, ...generos.map((g) => ({ value: catValor(g), label: etiquetaGenero(g) }))],
    [generos],
  );
  const deptoOpts: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Seleccione…' }, ...departamentos.map((d) => ({ value: d.codDepto, label: d.nombreDepto }))],
    [departamentos],
  );
  const munExpOpts: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Seleccione…' }, ...municipiosExp.map((m) => ({ value: m.codMunicipio, label: m.nombreMunicipio }))],
    [municipiosExp],
  );
  const munOrigenOpts: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Seleccione…' }, ...municipiosOrigen.map((m) => ({ value: m.codMunicipio, label: m.nombreMunicipio }))],
    [municipiosOrigen],
  );

  const cargarMunicipiosExp = useCallback(async (codDepto: string) => {
    if (!codDepto) {
      setMunicipiosExp([]);
      return;
    }
    try {
      setMunicipiosExp(await fetchMunicipios(codDepto));
    } catch {
      setMunicipiosExp([]);
    }
  }, []);

  const cargarMunicipiosOrigen = useCallback(async (codDepto: string) => {
    if (!codDepto) {
      setMunicipiosOrigen([]);
      return;
    }
    try {
      setMunicipiosOrigen(await fetchMunicipios(codDepto));
    } catch {
      setMunicipiosOrigen([]);
    }
  }, []);

  const aplicarMunicipioOrigenDesdeCodigo = useCallback(
    async (cod: string) => {
      const c0 = String(cod || '').trim();
      if (!c0) return;
      try {
        const m = await fetchMunicipioPorCodigo(c0);
        setDeptoOrigen(m.codDepto);
        const rows = await fetchMunicipios(m.codDepto);
        setMunicipiosOrigen(rows);
        setCodMunicipioOrigen(m.codMunicipio);
        patch({ codMunicipio: m.codMunicipio, munOrigen: m.codMunicipio });
      } catch {
        /* ignore */
      }
    },
    [patch],
  );

  const aplicarExpedidaDesdeTexto = useCallback(async (texto: string) => {
    const t = String(texto || '').trim();
    if (!t) return;
    try {
      const rows = await buscarMunicipios(t, 10);
      const exact = rows.find((r) => r.nombreMunicipio.toLowerCase() === t.toLowerCase()) || rows[0];
      if (!exact) return;
      setDeptoExp(exact.codDepto);
      const list = await fetchMunicipios(exact.codDepto);
      setMunicipiosExp(list);
      setCodMunicipioExp(exact.codMunicipio);
      patch({ expedida: exact.nombreMunicipio });
    } catch {
      /* ignore */
    }
  }, [patch]);

  const aplicarAlumnoArgo = useCallback(
    async (a: Record<string, string | number | boolean>) => {
      patch({
        tipoDoc: String(a.tipoDoc || form.tipoDoc),
        expedida: String(a.expedida || ''),
        apellido1: String(a.apellido1 || ''),
        apellido2: String(a.apellido2 || ''),
        nombre1: String(a.nombre1 || ''),
        nombre2: String(a.nombre2 || ''),
        genero: String(a.genero || '').toUpperCase(),
        fechaNac: String(a.fechaNac || ''),
        codMunicipio: String(a.codMunicipio || a.munOrigen || ''),
        munOrigen: String(a.munOrigen || a.codMunicipio || ''),
      });
      await aplicarMunicipioOrigenDesdeCodigo(String(a.codMunicipio || a.munOrigen || ''));
      await aplicarExpedidaDesdeTexto(String(a.expedida || ''));
      setInfo(
        a.tieneCorreoEnArgo
          ? 'Ya está inscrito en ARGO. Defina correo y contraseña para el portal.'
          : 'Ya está inscrito en ARGO. Solo cree correo y contraseña; sus datos se conservan.',
      );
    },
    [aplicarExpedidaDesdeTexto, aplicarMunicipioOrigenDesdeCodigo, form.tipoDoc, patch],
  );

  async function onBuscarDocumento() {
    const nd = form.numDoc.trim();
    if (!nd) {
      setError('Ingrese su número de documento.');
      return;
    }
    setBuscando(true);
    setError('');
    setInfo('');
    try {
      const res = await buscarAlumnoRegistro(nd);
      setAlumnoEnArgo(res.existeEnArgo);
      if (res.tieneCuentaPortal) {
        Alert.alert(
          'Registro',
          `Este documento ya tiene cuenta${res.emailPortal ? ` (${res.emailPortal})` : ''}. Use «Acceder».`,
          [{ text: 'Ir a acceder', onPress: () => nav.navigate('Login') }],
        );
        return;
      }
      if (res.existeEnArgo && res.alumno) {
        await aplicarAlumnoArgo(res.alumno);
      } else {
        setInfo('Documento nuevo: complete sus datos como en recepción ARGO.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar el documento');
    } finally {
      setBuscando(false);
    }
  }

  async function onBuscarEmpresa(q: string) {
    setEmpresaBusq(q);
    if (!q.trim() || q.trim().length < 2) {
      setEmpresaSugs([]);
      return;
    }
    setEmpresaCargando(true);
    try {
      const rows = await buscarEmpresasPublico(q.trim());
      setEmpresaSugs(rows);
    } catch {
      setEmpresaSugs([]);
    } finally {
      setEmpresaCargando(false);
    }
  }

  function buildBody(): Record<string, unknown> {
    return {
      email: form.email.trim(),
      password: form.password,
      tipoDoc: form.tipoDoc,
      numDoc: form.numDoc.trim(),
      expedida: form.expedida,
      apellido1: form.apellido1,
      apellido2: form.apellido2,
      nombre1: form.nombre1,
      nombre2: form.nombre2,
      celular: form.celular,
      direccion: form.direccion,
      genero: form.genero,
      fechaNac: form.fechaNac,
      codMunicipio: form.codMunicipio,
      munOrigen: form.munOrigen,
      empresaId: form.empresaId,
    };
  }

  async function onEnviar() {
    if (config?.registroAbierto === false) {
      setError('El registro en línea está temporalmente cerrado.');
      return;
    }
    if (!form.email.trim() || !form.password || form.password.length < 6) {
      setError('Correo y contraseña (mín. 6 caracteres) son obligatorios.');
      return;
    }
    if (!form.numDoc.trim()) {
      setError('El número de documento es obligatorio.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const body = buildBody();
      if (config?.emailVerificacionRegistro) {
        const v = await registroSolicitar(body);
        setPendingId(v.pendingId);
        setEmailEnmascarado(v.email || '');
        setPaso('codigo');
        setInfo(v.message);
      } else {
        const auth = await registro(body);
        await applyAuthResponse(auth);
        Alert.alert('Registro', 'Cuenta creada correctamente');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmarCodigo() {
    const codigo = codigoVerificacion.trim();
    if (!/^\d{6}$/.test(codigo)) {
      setError('Ingrese el código de 6 dígitos que recibió por correo.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const auth = await registroConfirmar(pendingId, codigo);
      await applyAuthResponse(auth);
      Alert.alert('Registro', 'Correo verificado. Bienvenido.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setLoading(false);
    }
  }

  async function onReenviarCodigo() {
    if (!pendingId) return;
    setReenviando(true);
    setError('');
    try {
      const res = await registroReenviarCodigo(pendingId);
      setInfo(res.message);
      Alert.alert('Verificación', 'Código reenviado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar');
    } finally {
      setReenviando(false);
    }
  }

  if (paso === 'codigo') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.pad}>
          <SurfaceCard>
            <ScaledText baseSize={20} style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>
              Confirmar correo
            </ScaledText>
            <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 16 }}>
              Enviamos un código de 6 dígitos a {emailEnmascarado || form.email || 'su correo'}.
            </ScaledText>
            {info ? (
              <ScaledText baseSize={13} style={{ color: c.primary, marginBottom: 10 }}>
                {info}
              </ScaledText>
            ) : null}
            {error ? (
              <ScaledText baseSize={13} style={{ color: c.danger, marginBottom: 10 }}>
                {error}
              </ScaledText>
            ) : null}
            <FieldLabel>Código de verificación *</FieldLabel>
            <IconInput
              value={codigoVerificacion}
              onChangeText={setCodigoVerificacion}
              placeholder="000000"
              keyboardType="numeric"
              maxLength={6}
            />
            <PrimaryButton label="Confirmar y crear cuenta" onPress={onConfirmarCodigo} loading={loading} fullWidth />
            <PrimaryButton
              label={reenviando ? 'Reenviando…' : 'Reenviar código'}
              variant="ghost"
              onPress={onReenviarCodigo}
              disabled={reenviando}
              fullWidth
            />
            <PrimaryButton
              label="Volver al formulario"
              variant="ghost"
              onPress={() => {
                setPaso('formulario');
                setCodigoVerificacion('');
                setError('');
              }}
              fullWidth
            />
          </SurfaceCard>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <SurfaceCard>
          <ScaledText baseSize={20} style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>
            Crear cuenta
          </ScaledText>
          <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 16 }}>
            Si ya está en ARGO, ingrese su documento y el sistema cargará sus datos. Solo definirá correo y
            contraseña para el portal.
          </ScaledText>

          <FieldLabel>Correo *</FieldLabel>
          <IconInput
            value={form.email}
            onChangeText={(v) => patch({ email: v })}
            placeholder="Correo electrónico"
            icon="mail-outline"
            keyboardType="email-address"
          />

          <FieldLabel>Contraseña *</FieldLabel>
          <IconInput
            value={form.password}
            onChangeText={(v) => patch({ password: v })}
            placeholder="Mínimo 6 caracteres"
            icon="lock-closed-outline"
            secureTextEntry
          />

          <FormSelect
            label="Tipo documento *"
            value={form.tipoDoc}
            onChange={(v) => patch({ tipoDoc: v })}
            options={tiposDocOpts}
          />

          <FieldLabel>Número documento *</FieldLabel>
          <IconInput
            value={form.numDoc}
            onChangeText={(v) => patch({ numDoc: v })}
            placeholder="Documento"
            icon="card-outline"
            keyboardType="numeric"
          />
          <PrimaryButton
            label={buscando ? 'Buscando…' : 'Verificar en ARGO'}
            onPress={onBuscarDocumento}
            loading={buscando}
            variant="ghost"
            fullWidth
          />

          <SectionTitle>📍 Expedida en</SectionTitle>
          <FormSelect
            label="Departamento"
            value={deptoExp}
            onChange={(v) => {
              setDeptoExp(v);
              setCodMunicipioExp('');
              patch({ expedida: '' });
              void cargarMunicipiosExp(v);
            }}
            options={deptoOpts}
          />
          <FormSelect
            label="Ciudad / municipio"
            value={codMunicipioExp}
            onChange={(v) => {
              setCodMunicipioExp(v);
              const m = municipiosExp.find((x) => x.codMunicipio === v);
              patch({ expedida: m?.nombreMunicipio || '' });
            }}
            options={munExpOpts}
            disabled={!deptoExp}
          />

          <FieldLabel>Primer apellido *</FieldLabel>
          <IconInput
            value={form.apellido1}
            onChangeText={(v) => patch({ apellido1: v })}
            placeholder="Primer apellido"
            icon="person-outline"
            autoCapitalize="words"
          />

          <FieldLabel>Segundo apellido</FieldLabel>
          <IconInput
            value={form.apellido2}
            onChangeText={(v) => patch({ apellido2: v })}
            placeholder="Segundo apellido"
            icon="person-outline"
            autoCapitalize="words"
          />

          <FieldLabel>Primer nombre *</FieldLabel>
          <IconInput
            value={form.nombre1}
            onChangeText={(v) => patch({ nombre1: v })}
            placeholder="Primer nombre"
            icon="person-outline"
            autoCapitalize="words"
          />

          <FieldLabel>Segundo nombre</FieldLabel>
          <IconInput
            value={form.nombre2}
            onChangeText={(v) => patch({ nombre2: v })}
            placeholder="Segundo nombre"
            icon="person-outline"
            autoCapitalize="words"
          />

          <FormSelect label="Género" value={form.genero} onChange={(v) => patch({ genero: v })} options={generoOpts} />

          <ArgoDateInput
            label="Fecha nacimiento"
            value={form.fechaNac}
            onChange={(v) => patch({ fechaNac: v })}
            max={ymdToday()}
          />

          <FieldLabel>Celular</FieldLabel>
          <IconInput
            value={form.celular}
            onChangeText={(v) => patch({ celular: v })}
            placeholder="Celular"
            icon="call-outline"
            keyboardType="numeric"
          />

          <FieldLabel>Dirección</FieldLabel>
          <IconInput
            value={form.direccion}
            onChangeText={(v) => patch({ direccion: v })}
            placeholder="Dirección"
            icon="home-outline"
          />

          <SectionTitle>🏠 Ciudad de residencia</SectionTitle>
          <FormSelect
            label="Departamento"
            value={deptoOrigen}
            onChange={(v) => {
              setDeptoOrigen(v);
              setCodMunicipioOrigen('');
              patch({ codMunicipio: '', munOrigen: '' });
              void cargarMunicipiosOrigen(v);
            }}
            options={deptoOpts}
          />
          <FormSelect
            label="Ciudad / municipio"
            value={codMunicipioOrigen}
            onChange={(v) => {
              setCodMunicipioOrigen(v);
              patch({ codMunicipio: v, munOrigen: v });
            }}
            options={munOrigenOpts}
            disabled={!deptoOrigen}
          />

          <SectionTitle>🏢 Empresa (opcional)</SectionTitle>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 8 }}>
            Si trabaja para una empresa de transporte, vincúlela aquí.
          </ScaledText>
          {form.empresaNombre ? (
            <View style={[styles.empresaChip, { borderColor: c.border, backgroundColor: c.inputBg }]}>
              <ScaledText baseSize={14} style={{ color: c.text, flex: 1 }}>
                🏢 {form.empresaNombre}
              </ScaledText>
              <Pressable
                onPress={() => {
                  patch({ empresaId: null, empresaNombre: null });
                  setEmpresaBusq('');
                  setEmpresaSugs([]);
                }}
              >
                <ScaledText baseSize={13} style={{ color: c.danger, fontWeight: '700' }}>
                  Quitar
                </ScaledText>
              </Pressable>
            </View>
          ) : (
            <>
              <IconInput
                value={empresaBusq}
                onChangeText={onBuscarEmpresa}
                placeholder="Buscar empresa por nombre o NIT…"
                icon="business-outline"
              />
              {empresaCargando ? (
                <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 8 }}>
                  Buscando…
                </ScaledText>
              ) : null}
              {empresaSugs.map((e) => (
                <Pressable
                  key={e._id}
                  style={[styles.empresaSug, { borderColor: c.border }]}
                  onPress={() => {
                    patch({ empresaId: e._id, empresaNombre: e.nombre });
                    setEmpresaBusq(e.nombre);
                    setEmpresaSugs([]);
                  }}
                >
                  <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>
                    {e.nombre}
                  </ScaledText>
                  <ScaledText baseSize={12} style={{ color: c.textSoft }}>
                    {e.identificacion}
                  </ScaledText>
                </Pressable>
              ))}
            </>
          )}

          {info ? (
            <ScaledText baseSize={13} style={{ color: c.primary, marginTop: 8, marginBottom: 8 }}>
              {info}
            </ScaledText>
          ) : null}
          {alumnoEnArgo ? (
            <ScaledText baseSize={13} style={{ color: c.primary, marginBottom: 8 }}>
              Datos cargados desde ARGO.
            </ScaledText>
          ) : null}
          {error ? (
            <ScaledText baseSize={13} style={{ color: c.danger, marginBottom: 8 }}>
              {error}
            </ScaledText>
          ) : null}
          {config?.registroAbierto === false ? (
            <ScaledText baseSize={13} style={{ color: c.danger, marginBottom: 8 }}>
              El registro en línea está cerrado. Contacte al CEA.
            </ScaledText>
          ) : null}

          <PrimaryButton
            label={
              loading
                ? 'Enviando…'
                : config?.emailVerificacionRegistro
                  ? 'Enviar código al correo'
                  : 'Crear cuenta'
            }
            onPress={onEnviar}
            loading={loading}
            disabled={config?.registroAbierto === false}
            fullWidth
          />

          <PrimaryButton label="¿Ya tienes cuenta? Acceder" variant="ghost" onPress={() => nav.navigate('Login')} fullWidth />
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48 },
  empresaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 10,
    padding: space.md,
    marginBottom: space.md,
  },
  empresaSug: {
    borderWidth: 1,
    borderRadius: 8,
    padding: space.md,
    marginBottom: space.sm,
  },
});
