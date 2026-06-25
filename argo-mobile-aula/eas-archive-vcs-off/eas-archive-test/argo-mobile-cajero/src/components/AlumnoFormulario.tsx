import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { IconInput } from './IconInput';
import { FormSection } from './FormSection';
import { CatalogoSelectField } from './CatalogoSelectField';
import { MunicipioBuscarField } from './MunicipioBuscarField';
import { EmpresaBuscarField } from './EmpresaBuscarField';
import { CedulaScanLink, CedulaScanPanel } from './CedulaScanPanel';
import { PrimaryButton } from './PrimaryButton';
import { ScaledText } from './ScaledText';
import { SurfaceCard } from './SurfaceCard';
import type { AlumnoCrearDto, AlumnoDetalleItem, AlumnoDocVerificacion, AlumnoListItem } from '../api/domain';
import {
  actualizarAlumno,
  crearAlumno,
  verificarDocumentoAlumno,
  type AlumnoArchivos,
} from '../api/alumnosApi';
import { fetchCatalogosAlumno } from '../api/catalogosApi';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';
import { mayusculasNombre, nombreCompleto } from '../utils/format';
import {
  TIPOS_ALUMNO,
  TIPO_ALUMNO_DEFAULT,
  mapCatalogoOpciones,
  normalizarGenero,
  normalizarTipoAlumno,
  normalizarTipoSangre,
} from '../utils/alumnoCatalogo';
import type { SoportePago } from '../utils/pago';
import { mensajeErrorApi } from '../utils/pago';
import { capturarFotoAlumno } from '../utils/imageCapture';
import { alumnoDetalleToForm } from '../utils/alumnoFormMap';
import { urlArchivoAlumno } from '../utils/documentHtml';

export type AlumnoFormGuardado = {
  alumno: AlumnoListItem;
  nombre: string;
};

type Props = {
  mode?: 'create' | 'edit';
  alumnoId?: string;
  initial?: AlumnoDetalleItem;
  onGuardado: (r: AlumnoFormGuardado) => void;
  onCancelar?: () => void;
};

function emptyForm(): AlumnoCrearDto {
  return {
    tipoAlumno: TIPO_ALUMNO_DEFAULT,
    tipoDoc: '1',
    numDoc: '',
    expedida: '',
    apellido1: '',
    apellido2: '',
    nombre1: '',
    nombre2: '',
    fechaNac: '',
    observaciones: '',
    genero: '',
    tipoSangre: '',
    jornada: '',
    estadoCivil: '',
    estrato: '',
    regimenSalud: '',
    nivelFormacion: '',
    ocupacion: '',
    discapacidad: '9',
    munOrigen: '',
    codMunicipio: '',
    correo: '',
    direccion: '',
    celular: '',
    multiCulturalidad: 'NO_APLICA',
    empresaId: null,
    alertaPagoFrecuencia: '',
    alertaPago: '',
  };
}

export function AlumnoFormulario({
  mode = 'create',
  alumnoId,
  initial,
  onGuardado,
  onCancelar,
}: Props) {
  const isEdit = mode === 'edit' && !!alumnoId;
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  const [form, setForm] = useState<AlumnoCrearDto>(() =>
    initial ? alumnoDetalleToForm(initial).form : emptyForm(),
  );
  const [expedidaTexto, setExpedidaTexto] = useState(() =>
    initial ? alumnoDetalleToForm(initial).expedidaTexto : '',
  );
  const [munOrigenTexto, setMunOrigenTexto] = useState(() =>
    initial ? alumnoDetalleToForm(initial).munOrigenTexto : '',
  );
  const [empresaNombre, setEmpresaNombre] = useState(() =>
    initial ? alumnoDetalleToForm(initial).empresaNombre : '',
  );
  const [catalogos, setCatalogos] = useState<Awaited<ReturnType<typeof fetchCatalogosAlumno>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [duplicado, setDuplicado] = useState<AlumnoDocVerificacion | null>(null);
  const [foto, setFoto] = useState<SoportePago | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [scanVisible, setScanVisible] = useState(!isEdit);
  const [cedulaArchivo, setCedulaArchivo] = useState<SoportePago | null>(null);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!initial) return;
    const mapped = alumnoDetalleToForm(initial);
    setForm(mapped.form);
    setExpedidaTexto(mapped.expedidaTexto);
    setMunOrigenTexto(mapped.munOrigenTexto);
    setEmpresaNombre(mapped.empresaNombre);
    const fotoUrl = urlArchivoAlumno(initial.urlFoto);
    if (fotoUrl) setFotoPreview(fotoUrl);
  }, [initial]);

  useEffect(() => {
    void fetchCatalogosAlumno().then(setCatalogos);
  }, []);

  const patch = useCallback(<K extends keyof AlumnoCrearDto>(k: K, v: AlumnoCrearDto[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const patchNombre = useCallback(
    (k: 'nombre1' | 'nombre2' | 'apellido1' | 'apellido2', v: string) => {
      patch(k, mayusculasNombre(v) as AlumnoCrearDto[typeof k]);
    },
    [patch],
  );

  const verificarDoc = useCallback(async (doc: string) => {
    const limpio = doc.replace(/\D/g, '');
    if (limpio.length < 5) {
      setDuplicado(null);
      return;
    }
    setVerificando(true);
    try {
      const r = await verificarDocumentoAlumno(limpio);
      if (r.existe && isEdit && alumnoId && r._id === alumnoId) {
        setDuplicado(null);
        return;
      }
      setDuplicado(r.existe ? r : null);
    } catch {
      setDuplicado(null);
    } finally {
      setVerificando(false);
    }
  }, [alumnoId, isEdit]);

  useEffect(() => {
    const t = setTimeout(() => void verificarDoc(String(form.numDoc)), 450);
    return () => clearTimeout(t);
  }, [form.numDoc, verificarDoc]);

  const opts = useMemo(() => {
    if (!catalogos) return null;
    return {
      tiposDoc: mapCatalogoOpciones(catalogos.tiposDoc),
      generos: mapCatalogoOpciones(catalogos.generos),
      tiposSangre: mapCatalogoOpciones(catalogos.tiposSangre),
      jornadas: mapCatalogoOpciones(catalogos.jornadas),
      estadosCivil: mapCatalogoOpciones(catalogos.estadosCivil),
      estratos: mapCatalogoOpciones(catalogos.estratos),
      regimenesSalud: mapCatalogoOpciones(catalogos.regimenesSalud),
      nivelesFormacion: mapCatalogoOpciones(catalogos.nivelesFormacion),
      ocupaciones: mapCatalogoOpciones(catalogos.ocupaciones),
      discapacidades: mapCatalogoOpciones(catalogos.discapacidades),
      multi: mapCatalogoOpciones(catalogos.multiCulturalidades),
      alertaFreq: [
        { value: '', label: 'Sin recordatorio' },
        { value: 'mensual', label: 'Mensual' },
        { value: 'quincenal', label: 'Quincenal' },
      ],
    };
  }, [catalogos]);

  function aplicarOcr(s: Partial<AlumnoCrearDto & { genero?: string; tipoSangre?: string }>) {
    setForm((f) => ({
      ...f,
      tipoDoc: s.tipoDoc || f.tipoDoc || '1',
      numDoc: s.numDoc != null ? String(s.numDoc).replace(/\D/g, '') : f.numDoc,
      expedida: s.expedida?.trim() || f.expedida,
      apellido1: mayusculasNombre(s.apellido1 || f.apellido1 || ''),
      apellido2: mayusculasNombre(s.apellido2 || f.apellido2 || ''),
      nombre1: mayusculasNombre(s.nombre1 || f.nombre1 || ''),
      nombre2: mayusculasNombre(s.nombre2 || f.nombre2 || ''),
      fechaNac: s.fechaNac || f.fechaNac,
      genero: normalizarGenero(s.genero) || f.genero,
      tipoSangre: normalizarTipoSangre(s.tipoSangre) || f.tipoSangre,
    }));
    if (s.expedida?.trim()) setExpedidaTexto(s.expedida.trim());
  }

  async function elegirFoto(desdeCamara: boolean) {
    const img = await capturarFotoAlumno(desdeCamara ? 'camara' : 'galeria');
    if (!img) return;
    setFoto(img);
    setFotoPreview(img.uri);
  }

  async function guardar() {
    const doc = String(form.numDoc).replace(/\D/g, '');
    const n1 = mayusculasNombre(form.nombre1);
    const a1 = mayusculasNombre(form.apellido1);
    if (!doc || doc.length < 5) {
      Alert.alert('Documento', 'Indique un número de documento válido (mín. 5 dígitos).');
      return;
    }
    if (!n1 || !a1) {
      Alert.alert('Datos obligatorios', 'Primer nombre y primer apellido son requeridos.');
      return;
    }
    if (duplicado?.existe) {
      Alert.alert('Documento duplicado', `Ya existe: ${duplicado.nombreCompleto}`);
      return;
    }

    const payload: AlumnoCrearDto = {
      ...form,
      numDoc: doc,
      nombre1: n1,
      nombre2: mayusculasNombre(form.nombre2 || '') || undefined,
      apellido1: a1,
      apellido2: mayusculasNombre(form.apellido2 || '') || undefined,
      expedida: form.expedida?.trim() || expedidaTexto.trim() || undefined,
      tipoAlumno: normalizarTipoAlumno(form.tipoAlumno),
      correo: form.correo?.trim().toLowerCase() || undefined,
      celular: form.celular?.replace(/\D/g, '') || undefined,
      fechaNac: form.fechaNac?.trim() || undefined,
      alertaPagoFrecuencia: (form.alertaPagoFrecuencia || '') as AlumnoCrearDto['alertaPagoFrecuencia'],
      alertaPago: form.alertaPagoFrecuencia ? form.alertaPago?.trim() || undefined : undefined,
    };

    const files: AlumnoArchivos = { foto, cedula: cedulaArchivo };

    setBusy(true);
    try {
      const guardado = isEdit && alumnoId
        ? await actualizarAlumno(alumnoId, payload, files)
        : await crearAlumno(payload, files);
      onGuardado({ alumno: guardado, nombre: nombreCompleto(guardado) });
    } catch (e) {
      Alert.alert('No se pudo guardar', mensajeErrorApi(e));
    } finally {
      setBusy(false);
    }
  }

  if (!opts) {
    return (
      <SurfaceCard>
        <ScaledText baseSize={14} style={{ color: c.textSoft }}>Cargando catálogos…</ScaledText>
      </SurfaceCard>
    );
  }

  return (
    <View style={styles.root}>
      {scanVisible ? (
        <CedulaScanPanel
          visible
          onOmitir={() => setScanVisible(false)}
          onAplicado={({ patch, warnings, imagen }) => {
            aplicarOcr(patch);
            setScanWarnings(warnings || []);
            setCedulaArchivo(imagen);
            setScanVisible(false);
          }}
        />
      ) : (
        <CedulaScanLink onPress={() => setScanVisible(true)} />
      )}

      {scanWarnings.length ? (
        <SurfaceCard elevated={false} style={{ marginBottom: 12, padding: 12, backgroundColor: c.warnBg }}>
          {scanWarnings.map((w) => (
            <ScaledText key={w} baseSize={12} style={{ color: c.warn, marginBottom: 4 }}>• {w}</ScaledText>
          ))}
        </SurfaceCard>
      ) : null}

      <FormSection title="Identificación" subtitle="Documento, nombres, fecha de nacimiento y foto" icon="card-outline">
        <ScaledText baseSize={13} style={{ color: c.textSoft, fontWeight: '600' }}>Tipo de alumno</ScaledText>
        <View style={styles.chips}>
          {TIPOS_ALUMNO.map((t) => {
            const on = normalizarTipoAlumno(form.tipoAlumno) === t;
            return (
              <Pressable
                key={t}
                onPress={() => patch('tipoAlumno', t)}
                style={[styles.chip, { borderColor: c.border, backgroundColor: on ? c.primary : c.card }]}
              >
                <ScaledText baseSize={11} style={{ color: on ? '#fff' : c.text, fontWeight: '700' }}>{t}</ScaledText>
              </Pressable>
            );
          })}
        </View>
        {normalizarTipoAlumno(form.tipoAlumno) === 'Virtual' ? (
          <ScaledText baseSize={12} style={{ color: c.accent, fontWeight: '600' }}>Alumno del aula virtual (portal en línea)</ScaledText>
        ) : null}

        <CatalogoSelectField label="Tipo documento" value={form.tipoDoc || '1'} options={opts.tiposDoc} onChange={(v) => patch('tipoDoc', v)} required />

        <IconInput label="Número documento *" icon="finger-print-outline" value={String(form.numDoc)} onChangeText={(t) => patch('numDoc', t.replace(/[^\d]/g, ''))} keyboardType="number-pad" placeholder="Solo dígitos" />
        {verificando ? <ScaledText baseSize={12} style={{ color: c.textSoft }}>Verificando…</ScaledText> : null}
        {duplicado?.existe ? (
          <View style={[styles.dup, { backgroundColor: c.warnBg, borderColor: c.warn }]}>
            <ScaledText baseSize={13} style={{ color: c.text, fontWeight: '700' }}>Documento ya registrado: {duplicado.nombreCompleto}</ScaledText>
          </View>
        ) : null}

        <MunicipioBuscarField
          label="Expedida en"
          texto={expedidaTexto}
          onTextoChange={setExpedidaTexto}
          onSeleccion={(m) => patch('expedida', m.nombreMunicipio)}
          onLimpiar={() => patch('expedida', '')}
          placeholder="Municipio de expedición…"
        />

        <IconInput label="Primer apellido *" icon="text-outline" value={form.apellido1} onChangeText={(t) => patchNombre('apellido1', t)} autoCapitalize="characters" />
        <IconInput label="Segundo apellido" icon="text-outline" value={form.apellido2 || ''} onChangeText={(t) => patchNombre('apellido2', t)} autoCapitalize="characters" />
        <IconInput label="Primer nombre *" icon="text-outline" value={form.nombre1} onChangeText={(t) => patchNombre('nombre1', t)} autoCapitalize="characters" />
        <IconInput label="Segundo nombre" icon="text-outline" value={form.nombre2 || ''} onChangeText={(t) => patchNombre('nombre2', t)} autoCapitalize="characters" />

        <IconInput label="Fecha nacimiento" icon="calendar-outline" value={form.fechaNac || ''} onChangeText={(t) => patch('fechaNac', t.replace(/[^\d-]/g, '').slice(0, 10))} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" />

        <ScaledText baseSize={13} style={{ color: c.textSoft, fontWeight: '600', marginTop: 4 }}>Foto del alumno</ScaledText>
        <View style={styles.fotoRow}>
          <View style={[styles.fotoBox, { borderColor: c.border, backgroundColor: c.bg }]}>
            {fotoPreview ? (
              <Image source={{ uri: fotoPreview }} style={styles.fotoImg} />
            ) : (
              <ScaledText baseSize={12} style={{ color: c.textSoft }}>Sin foto</ScaledText>
            )}
          </View>
          <View style={styles.fotoBtns}>
            <PrimaryButton label="Tomar foto" icon="camera-outline" variant="ghost" onPress={() => void elegirFoto(true)} style={{ flex: 1 }} />
            <PrimaryButton label="Galería" icon="images-outline" variant="ghost" onPress={() => void elegirFoto(false)} style={{ flex: 1 }} />
          </View>
        </View>
      </FormSection>

      <FormSection title="Datos personales" subtitle="Salud, formación, jornada y ocupación" icon="body-outline" tone="neutral">
        <CatalogoSelectField label="Género" value={form.genero || ''} options={opts.generos} onChange={(v) => patch('genero', v)} />
        <CatalogoSelectField label="Tipo de sangre" value={form.tipoSangre || ''} options={opts.tiposSangre} onChange={(v) => patch('tipoSangre', v)} />
        <CatalogoSelectField label="Jornada" value={form.jornada || ''} options={opts.jornadas} onChange={(v) => patch('jornada', v)} />
        <CatalogoSelectField label="Estado civil" value={form.estadoCivil || ''} options={opts.estadosCivil} onChange={(v) => patch('estadoCivil', v)} />
        <CatalogoSelectField label="Estrato" value={form.estrato || ''} options={opts.estratos} onChange={(v) => patch('estrato', v)} />
        <CatalogoSelectField label="Régimen de salud" value={form.regimenSalud || ''} options={opts.regimenesSalud} onChange={(v) => patch('regimenSalud', v)} />
        <CatalogoSelectField label="Nivel de formación" value={form.nivelFormacion || ''} options={opts.nivelesFormacion} onChange={(v) => patch('nivelFormacion', v)} />
        <CatalogoSelectField label="Ocupación" value={form.ocupacion || ''} options={opts.ocupaciones} onChange={(v) => patch('ocupacion', v)} />
      </FormSection>

      <FormSection title="Contacto y ubicación" subtitle="Correo, celular, dirección y municipio de origen" icon="call-outline" tone="accent">
        <IconInput label="Correo" icon="mail-outline" value={form.correo || ''} onChangeText={(t) => patch('correo', t)} autoCapitalize="none" keyboardType="email-address" placeholder="correo@ejemplo.com" />
        <IconInput label="Celular" icon="phone-portrait-outline" value={form.celular || ''} onChangeText={(t) => patch('celular', t.replace(/[^\d]/g, ''))} keyboardType="phone-pad" placeholder="3001234567" />
        <IconInput label="Dirección" icon="home-outline" value={form.direccion || ''} onChangeText={(t) => patch('direccion', t)} placeholder="Dirección de residencia" />
        <MunicipioBuscarField
          label="Municipio de origen"
          texto={munOrigenTexto}
          onTextoChange={setMunOrigenTexto}
          onSeleccion={(m) => {
            patch('munOrigen', m.codMunicipio);
            patch('codMunicipio', m.codMunicipio);
            setMunOrigenTexto(m.label);
          }}
          onLimpiar={() => {
            patch('munOrigen', '');
            patch('codMunicipio', '');
          }}
        />
      </FormSection>

      <FormSection title="Recordatorio de cobro" subtitle="Aviso al cajero para cuotas recurrentes (técnicos)" icon="notifications-outline">
        <CatalogoSelectField
          label="Frecuencia"
          value={form.alertaPagoFrecuencia || ''}
          options={opts.alertaFreq}
          onChange={(v) => {
            patch('alertaPagoFrecuencia', v as AlumnoCrearDto['alertaPagoFrecuencia']);
            if (!v) patch('alertaPago', '');
          }}
        />
        {form.alertaPagoFrecuencia ? (
          <>
            <IconInput label="Día de referencia" icon="calendar-outline" value={form.alertaPago || ''} onChangeText={(t) => patch('alertaPago', t.replace(/[^\d-]/g, '').slice(0, 10))} placeholder="AAAA-MM-DD" />
            <ScaledText baseSize={11} style={{ color: c.textSoft, lineHeight: 16 }}>
              Mensual: mismo día cada mes. Quincenal: cada 15 días desde esta fecha.
            </ScaledText>
          </>
        ) : null}
      </FormSection>

      <FormSection title="Origen y diversidad" subtitle="Discapacidad, multiculturalidad y observaciones" icon="earth-outline" tone="neutral">
        <CatalogoSelectField label="Discapacidad" value={form.discapacidad || '9'} options={opts.discapacidades} onChange={(v) => patch('discapacidad', v || '9')} />
        <CatalogoSelectField label="Multiculturalidad" value={form.multiCulturalidad || 'NO_APLICA'} options={opts.multi} onChange={(v) => patch('multiCulturalidad', v || 'NO_APLICA')} />
        <IconInput label="Observaciones" icon="document-text-outline" value={form.observaciones || ''} onChangeText={(t) => patch('observaciones', t)} multiline style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }} />
      </FormSection>

      <FormSection title="Empresa" subtitle="Empresa de transporte u organización del alumno" icon="business-outline">
        <EmpresaBuscarField
          empresaId={form.empresaId ?? null}
          empresaNombre={empresaNombre}
          onChange={(id, nom) => {
            patch('empresaId', id);
            setEmpresaNombre(nom);
          }}
        />
      </FormSection>

      <PrimaryButton
        label={busy ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear alumno'}
        icon="checkmark-circle-outline"
        onPress={() => void guardar()}
        disabled={busy || !!duplicado?.existe}
        fullWidth
      />
      {onCancelar ? (
        <PrimaryButton label="Cancelar" variant="ghost" onPress={onCancelar} disabled={busy} fullWidth style={{ marginTop: 10 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  dup: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
  fotoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fotoBtns: { flex: 1, gap: 8 },
  fotoBox: { width: 72, height: 72, borderRadius: 12, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fotoImg: { width: 72, height: 72 },
});
