import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { BuscarPickerField } from '../../components/BuscarPickerField';
import { ScreenBody } from '../../components/ScreenBody';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { MoneyText } from '../../components/MoneyText';
import { PrimaryButton } from '../../components/PrimaryButton';
import { VerDocumentoButton } from '../../components/VerDocumentoButton';
import { CertificadoFila } from '../../components/CertificadoFila';
import {
  PagoCobroFields,
  pagoCobroStateInicial,
  validarEstadoPago,
  type PagoCobroState,
} from '../../components/PagoCobroFields';
import { fetchTiposPago } from '../../api/catalogosApi';
import { fetchAlumnoPorDoc, fetchAlumnoPorId } from '../../api/alumnosApi';
import {
  aplicarCombo,
  listarCombos,
  previstaCombo,
  type ComboAplicarRes,
  type ComboItem,
  type ComboPrevista,
} from '../../api/combosApi';
import { crearLiquidacion, listarLiquidacionAlumno } from '../../api/liquidacionApi';
import { crearIngreso, listarIngresosAlumno, reciboIngresoHtmlPath } from '../../api/ingresosApi';
import { crearMatricula } from '../../api/matriculasApi';
import { fetchOpcionesMatricula } from '../../api/configApi';
import { MatriculaAjustePanel } from '../../components/MatriculaAjustePanel';
import { AlumnoCard } from '../../components/AlumnoCard';
import {
  cuotasSemestreCatalogo,
  normalizarCuotaEntera,
  repartirCuotasEquitativo,
  resolverCuotasSemestreNumeros,
} from '../../utils/cuotasSemestre';
import { listarProgramas } from '../../api/programasApi';
import { listarServicios } from '../../api/serviciosApi';
import { emitirFactura, facturaHtmlPath, listarElegiblesFe, listarFacturasAlumno } from '../../api/facturacionApi';
import { listarCertificadosAlumno } from '../../api/certificadosApi';
import { previewMatriculaExtras, type PreviewServicioAdicionalItem } from '../../api/configApi';
import type {
  CertificadoItem,
  FacturaElectronicaItem,
  IngresoRow,
  LiquidacionItem,
  ProgramaItem,
  ServicioItem,
  AlumnoDetalleItem,
} from '../../api/domain';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';
import {
  calcularValorMatricula,
  descrConCantidad,
  esProgramaCea,
  esProgramaSoloVirtual,
  etiquetaTarifa,
  idPrograma,
  idServicio,
  labelPrograma,
  permiteCantidadServicio,
  programasParaMatricula,
  serviciosAdicionalesLista,
  serviciosPrograma,
  tarifasPermitidasPrograma,
  valorServicioAdicional,
  TARIFA_VIRTUAL,
  type TarifaMatricula,
} from '../../utils/matricula';
import {
  esLiquidacionVirtual,
  mensajeErrorApi,
} from '../../utils/pago';
import { nombreCompleto } from '../../utils/format';

type Tab = 'pagos' | 'servicios' | 'comprobantes' | 'certificados';

type ItemPagoSel = {
  idLiquidacion: string;
  descripcion: string;
  saldo: number;
  valor: number;
  valorText?: string;
};

function valorItemInput(it: ItemPagoSel): string {
  if (it.valorText != null) return it.valorText;
  if (!(it.valor > 0)) return '';
  return String(Math.round(it.valor));
}

function esAbonoParcial(it: ItemPagoSel): boolean {
  return it.valor > 0 && it.valor < it.saldo - 0.0001;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'pagos', label: 'Pagos' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'comprobantes', label: 'Recibos y FE' },
  { id: 'certificados', label: 'Certificados' },
];

export default function AlumnoDetalleScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AlumnoDetalle'>>();
  const { numDoc, nombre: nombreRoute } = route.params;
  const [alumnoId, setAlumnoId] = useState(route.params.alumnoId ?? '');
  const [displayNombre, setDisplayNombre] = useState(nombreRoute);
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [tab, setTab] = useState<Tab>('pagos');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liquidacion, setLiquidacion] = useState<LiquidacionItem[]>([]);
  const [totales, setTotales] = useState({ saldo: 0 });
  const [pagos, setPagos] = useState<IngresoRow[]>([]);
  const [facturas, setFacturas] = useState<FacturaElectronicaItem[]>([]);
  const [certificados, setCertificados] = useState<CertificadoItem[]>([]);
  const [certErr, setCertErr] = useState<string | null>(null);
  const [itemsPago, setItemsPago] = useState<ItemPagoSel[]>([]);
  const [programas, setProgramas] = useState<ProgramaItem[]>([]);
  const [servicios, setServicios] = useState<ServicioItem[]>([]);
  const [elegiblesFe, setElegiblesFe] = useState<string[]>([]);
  const [progSelId, setProgSelId] = useState('');
  const [tarifa, setTarifa] = useState<TarifaMatricula>(1);
  const [servSelIds, setServSelIds] = useState<string[]>([]);
  const [serviciosDraft, setServiciosDraft] = useState<Record<string, { cantidad: string; valor: string }>>({});
  const [extrasMatricula, setExtrasMatricula] = useState<PreviewServicioAdicionalItem[]>([]);
  const [pagoCobro, setPagoCobro] = useState<PagoCobroState>(() => pagoCobroStateInicial());
  const [tiposPago, setTiposPago] = useState<Awaited<ReturnType<typeof fetchTiposPago>>>([]);
  const [alumnoCorreo, setAlumnoCorreo] = useState('');
  const [alumnoInfo, setAlumnoInfo] = useState<AlumnoDetalleItem | null>(null);
  const [matriculaEmailPortal, setMatriculaEmailPortal] = useState('');
  const [combos, setCombos] = useState<ComboItem[]>([]);
  const [comboSelId, setComboSelId] = useState('');
  const [comboPrevista, setComboPrevista] = useState<ComboPrevista | null>(null);
  const [comboResultado, setComboResultado] = useState<ComboAplicarRes | null>(null);
  const [permitirAjusteValorMatricula, setPermitirAjusteValorMatricula] = useState(true);
  const [permitirAjusteCuotasSemestre, setPermitirAjusteCuotasSemestre] = useState(false);
  const [ajustarValorMat, setAjustarValorMat] = useState(false);
  const [valorAcordadoMat, setValorAcordadoMat] = useState('');
  const [motivoAjusteMat, setMotivoAjusteMat] = useState('');
  const [ajustarCuotasSemestre, setAjustarCuotasSemestre] = useState(false);
  const [valoresCuotasSemestre, setValoresCuotasSemestre] = useState<(number | null)[]>([]);
  const [motivoAjusteCuotas, setMotivoAjusteCuotas] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setCertErr(null);
    try {
      const [liq, ing, progs, servs, eleg, fac, alumno, tipos, combosList, opcionesMat] = await Promise.all([
        listarLiquidacionAlumno(numDoc),
        listarIngresosAlumno(numDoc),
        listarProgramas({ catalogo: true }),
        listarServicios({ catalogo: true }),
        listarElegiblesFe(numDoc).catch(() => []),
        listarFacturasAlumno(numDoc).catch(() => []),
        fetchAlumnoPorDoc(numDoc).catch(() => null),
        fetchTiposPago().catch(() => []),
        listarCombos().catch(() => []),
        fetchOpcionesMatricula().catch(() => ({
          permitirAjusteValorMatricula: true,
          permitirAjusteCuotasSemestre: false,
        })),
      ]);
      setPermitirAjusteValorMatricula(opcionesMat.permitirAjusteValorMatricula !== false);
      setPermitirAjusteCuotasSemestre(opcionesMat.permitirAjusteCuotasSemestre === true);
      setLiquidacion(liq.items);
      setTotales({ saldo: liq.totales?.saldo ?? 0 });
      setPagos(ing);
      setProgramas(progs);
      setServicios(servs);
      setElegiblesFe(eleg.map((e) => e._id));
      setFacturas(fac);
      let info: AlumnoDetalleItem | null = null;
      const idAlumno = route.params.alumnoId || alumnoId;
      if (idAlumno) {
        info = await fetchAlumnoPorId(idAlumno).catch(() => null);
      } else if (alumno?._id) {
        info = await fetchAlumnoPorId(alumno._id).catch(() => null);
      }
      if (!info && alumno) info = alumno as AlumnoDetalleItem;
      setAlumnoInfo(info);
      setAlumnoCorreo(String(info?.correo || alumno?.correo || '').trim());
      if (info?._id) setAlumnoId(info._id);
      else if (alumno?._id) setAlumnoId(alumno._id);
      if (info || alumno) {
        const nc = nombreCompleto(info || alumno!);
        if (nc) {
          setDisplayNombre(nc);
          nav.setOptions({ title: nc });
        }
      }
      setTiposPago(tipos);
      setCombos(combosList);

      try {
        const certs = await listarCertificadosAlumno(numDoc);
        setCertificados(certs);
      } catch (e) {
        setCertificados([]);
        setCertErr(e instanceof Error ? e.message : 'Sin acceso a certificados');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, [numDoc, route.params.alumnoId, alumnoId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const programasMat = useMemo(() => programasParaMatricula(programas), [programas]);
  const opcionesProgramas = useMemo(
    () =>
      programasMat.map((p) => ({
        id: idPrograma(p),
        title: labelPrograma(p),
        subtitle: p.codigoProg ? `Código ${p.codigoProg}` : undefined,
        keywords: [p.descripcion, p.nomCert, p.tipoCap].filter(Boolean).join(' '),
      })),
    [programasMat],
  );
  const programaSel = useMemo(
    () => programasMat.find((p) => idPrograma(p) === progSelId) ?? null,
    [programasMat, progSelId],
  );
  const serviciosProgSel = useMemo(
    () => serviciosPrograma(programaSel, servicios),
    [programaSel, servicios],
  );
  const tarifasPermitidas = useMemo(
    () => (programaSel ? tarifasPermitidasPrograma(programaSel, serviciosProgSel) : [1, 2, 3]),
    [programaSel, serviciosProgSel],
  );
  const programaSoloVirtual = useMemo(
    () => esProgramaSoloVirtual(programaSel, serviciosProgSel),
    [programaSel, serviciosProgSel],
  );
  const esTarifaVirtualSel = tarifa === TARIFA_VIRTUAL;
  const valorMatricula = useMemo(
    () => calcularValorMatricula(programaSel, servicios, tarifa),
    [programaSel, servicios, tarifa],
  );
  const totalExtrasMatricula = useMemo(
    () => extrasMatricula.reduce((a, i) => a + (Number(i.valor) || 0), 0),
    [extrasMatricula],
  );
  const cuotasCatalogo = useMemo(
    () => cuotasSemestreCatalogo(serviciosProgSel, tarifa),
    [serviciosProgSel, tarifa],
  );
  const numCuotasSemestre = cuotasCatalogo.length;
  const totalCuotasSemestre = useMemo(
    () => valoresCuotasSemestre.reduce<number>((acc, v) => acc + (v ?? 0), 0),
    [valoresCuotasSemestre],
  );
  const valorAcordadoNum = useMemo(() => {
    const n = Math.round(Number(valorAcordadoMat.replace(/\D/g, '') || '0'));
    return Number.isFinite(n) && n >= 0 ? n : valorMatricula;
  }, [valorAcordadoMat, valorMatricula]);
  const rebajaMatricula = useMemo(() => {
    if (!ajustarValorMat) return 0;
    return valorMatricula > valorAcordadoNum ? valorMatricula - valorAcordadoNum : 0;
  }, [ajustarValorMat, valorMatricula, valorAcordadoNum]);
  const valorMatriculaTotal = useMemo(() => {
    if (ajustarCuotasSemestre && permitirAjusteCuotasSemestre && !esTarifaVirtualSel && numCuotasSemestre >= 2) {
      return totalCuotasSemestre + totalExtrasMatricula;
    }
    if (ajustarValorMat && permitirAjusteValorMatricula && !esTarifaVirtualSel && valorMatricula > 0) {
      return valorAcordadoNum + totalExtrasMatricula;
    }
    return valorMatricula + totalExtrasMatricula;
  }, [
    ajustarCuotasSemestre,
    permitirAjusteCuotasSemestre,
    esTarifaVirtualSel,
    numCuotasSemestre,
    totalCuotasSemestre,
    totalExtrasMatricula,
    ajustarValorMat,
    permitirAjusteValorMatricula,
    valorMatricula,
    valorAcordadoNum,
  ]);

  function limpiarAjustesMatricula() {
    setAjustarValorMat(false);
    setValorAcordadoMat('');
    setMotivoAjusteMat('');
    setAjustarCuotasSemestre(false);
    setValoresCuotasSemestre([]);
    setMotivoAjusteCuotas('');
  }

  function cuotasDesdeCatalogo(): number[] {
    return cuotasCatalogo.map((v) => Math.round(v));
  }

  function onAjustarValorMatChange(activo: boolean) {
    setAjustarValorMat(activo);
    if (activo) {
      setAjustarCuotasSemestre(false);
      setValoresCuotasSemestre([]);
      setMotivoAjusteCuotas('');
      setValorAcordadoMat(String(Math.round(valorMatricula)));
    } else {
      setValorAcordadoMat('');
      setMotivoAjusteMat('');
    }
  }

  function onAjustarCuotasSemestreChange(activo: boolean) {
    setAjustarCuotasSemestre(activo);
    if (activo) {
      setAjustarValorMat(false);
      setValorAcordadoMat('');
      setMotivoAjusteMat('');
      setValoresCuotasSemestre(cuotasDesdeCatalogo());
    } else {
      setValoresCuotasSemestre([]);
      setMotivoAjusteCuotas('');
    }
  }

  function onCuotaSemestreChange(index: number, raw: string) {
    const next = [...valoresCuotasSemestre];
    next[index] = normalizarCuotaEntera(raw.replace(/[^\d]/g, ''));
    setValoresCuotasSemestre(next);
  }

  function cuotaSemestreInvalida(index: number): boolean {
    return valoresCuotasSemestre[index] === null;
  }

  useEffect(() => {
    const idP = programaSel ? idPrograma(programaSel) : '';
    if (!idP) {
      setExtrasMatricula([]);
      return;
    }
    let cancel = false;
    previewMatriculaExtras(idP, tarifa)
      .then((r) => {
        if (!cancel) setExtrasMatricula(r.items || []);
      })
      .catch(() => {
        if (!cancel) setExtrasMatricula([]);
      });
    return () => {
      cancel = true;
    };
  }, [programaSel, tarifa]);
  const opcionesCombos = useMemo(
    () =>
      combos.map((cb) => ({
        id: cb.id,
        title: cb.nombre,
        subtitle: cb.descripcion?.trim() || `${cb.programas?.length ?? 0} programa(s) · Tarifa 2`,
        keywords: cb.descripcion,
      })),
    [combos],
  );

  const serviciosAdicionales = useMemo(() => serviciosAdicionalesLista(servicios), [servicios]);
  const opcionesServicios = useMemo(
    () =>
      serviciosAdicionales.map((s) => {
        const tarifa1 = Number(s.tarifa1) || 0;
        return {
          id: idServicio(s),
          title: String(s.descrServicio || s.descripcion || 'Servicio'),
          subtitle: [s.programaNombre, tarifa1 > 0 ? `$${tarifa1.toLocaleString('es-CO')}` : 'Valor variable']
            .filter(Boolean)
            .join(' · '),
          keywords: [s.tipoServ, s.programaNombre].filter(Boolean).join(' '),
        };
      }),
    [serviciosAdicionales],
  );

  useEffect(() => {
    setServiciosDraft((prev) => {
      const next = { ...prev };
      for (const id of servSelIds) {
        if (next[id]) continue;
        const s = serviciosAdicionales.find((x) => idServicio(x) === id);
        const sugerido = Number(s?.tarifa1) || 0;
        next[id] = {
          cantidad: '1',
          valor: sugerido > 0 ? String(Math.round(sugerido)) : '',
        };
      }
      for (const k of Object.keys(next)) {
        if (!servSelIds.includes(k)) delete next[k];
      }
      return next;
    });
  }, [servSelIds, serviciosAdicionales]);

  const pendientes = liquidacion.filter((i) => (Number(i.saldo) || 0) > 0);
  const subtotalPago = itemsPago.reduce((a, i) => a + (Number(i.valor) || 0), 0);
  const totalPago = subtotalPago + (pagoCobro.totalExtras || 0);
  const idsLiquidacionPago = itemsPago.map((i) => i.idLiquidacion);

  function liquidacionPorId(id: string): LiquidacionItem | undefined {
    return liquidacion.find((i) => i._id === id);
  }

  function patchPagoCobro(patch: Partial<PagoCobroState>) {
    setPagoCobro((s) => ({ ...s, ...patch }));
  }

  function itemSeleccionado(id: string): boolean {
    return itemsPago.some((x) => x.idLiquidacion === id);
  }

  function toggleItem(item: LiquidacionItem) {
    const id = item._id;
    setItemsPago((arr) => {
      if (arr.some((x) => x.idLiquidacion === id)) {
        return arr.filter((x) => x.idLiquidacion !== id);
      }
      const saldo = Number(item.saldo) || 0;
      return [
        ...arr,
        {
          idLiquidacion: id,
          descripcion: item.descripcion || 'Servicio',
          saldo,
          valor: saldo,
        },
      ];
    });
  }

  function setValorItem(idLiq: string, val: string) {
    const liq = liquidacionPorId(idLiq);
    if (liq && esLiquidacionVirtual(liq)) {
      pagarSaldoCompleto(idLiq);
      return;
    }
    const raw = val.replace(/[^\d]/g, '');
    const n = raw === '' ? 0 : Number(raw);
    setItemsPago((arr) =>
      arr.map((x) => {
        if (x.idLiquidacion !== idLiq) return x;
        const valor = raw === '' ? 0 : Math.max(0, Math.min(n, x.saldo));
        return { ...x, valor, valorText: raw };
      }),
    );
  }

  function pagarSaldoCompleto(idLiq: string) {
    setItemsPago((arr) =>
      arr.map((x) =>
        x.idLiquidacion === idLiq ? { ...x, valor: x.saldo, valorText: undefined } : x,
      ),
    );
  }

  async function registrarPago() {
    const validos = itemsPago.filter((i) => i.valor > 0);
    if (!validos.length) {
      Alert.alert('Pagos', 'Seleccione ítems e indique un valor mayor a cero.');
      return;
    }
    for (const i of validos) {
      const liq = liquidacionPorId(i.idLiquidacion);
      if (liq && esLiquidacionVirtual(liq) && Math.abs(i.valor - i.saldo) > 0.0001) {
        Alert.alert(
          'Matrícula virtual',
          `«${i.descripcion}» debe pagarse en su totalidad (${Math.round(i.saldo).toLocaleString('es-CO')} COP).`,
        );
        return;
      }
    }
    const excede = validos.find((i) => i.valor > i.saldo + 0.0001);
    if (excede) {
      Alert.alert('Pagos', `El valor de «${excede.descripcion}» excede el saldo pendiente.`);
      return;
    }
    const valPago = validarEstadoPago(pagoCobro, tiposPago);
    if (!valPago.ok) {
      Alert.alert('Pagos', valPago.message ?? 'Complete los datos del pago.');
      return;
    }
    setBusy(true);
    try {
      const ing = await crearIngreso(
        {
          numDoc,
          items: validos.map((i) => ({ idLiquidacion: i.idLiquidacion, valor: i.valor })),
          idTipoPago: pagoCobro.idTipoPago,
          idCuentaBancaria: pagoCobro.idCuentaBancaria || undefined,
          numComprobante: pagoCobro.numComprobante.trim() || undefined,
          observaciones: pagoCobro.observaciones.trim() || undefined,
        },
        pagoCobro.soporte,
      );
      const num = ing.numRecibo ?? ing._id;
      Alert.alert('Pago registrado', `Recibo #${num}`, [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: 'Imprimir recibo',
          onPress: () =>
            nav.navigate('DocumentoViewer', {
              title: `Recibo ${num}`,
              htmlPath: reciboIngresoHtmlPath(ing._id),
            }),
        },
      ]);
      setItemsPago([]);
      setPagoCobro(pagoCobroStateInicial());
      await load();
      setTab('comprobantes');
    } catch (e) {
      Alert.alert('Error', mensajeErrorApi(e));
    } finally {
      setBusy(false);
    }
  }

  function limpiarCombo() {
    setComboSelId('');
    setComboPrevista(null);
    setComboResultado(null);
  }

  async function onComboElegido(id: string) {
    if (!id) {
      limpiarCombo();
      return;
    }
    setComboSelId(id);
    setComboPrevista(null);
    setComboResultado(null);
    try {
      const prev = await previstaCombo(id);
      setComboPrevista(prev);
    } catch (e) {
      limpiarCombo();
      Alert.alert('Combo', e instanceof Error ? e.message : 'No se pudo cargar la prevista del combo');
    }
  }

  async function aplicarComboAlumno() {
    if (!comboSelId) {
      Alert.alert('Combo', 'Seleccione un combo.');
      return;
    }
    setBusy(true);
    setComboResultado(null);
    try {
      const res = await aplicarCombo(comboSelId, numDoc);
      setComboResultado(res);
      Alert.alert(res.ok ? 'Combo aplicado' : 'Combo parcial', res.message);
      await load();
      setTab('pagos');
    } catch (e) {
      Alert.alert('Error', mensajeErrorApi(e));
    } finally {
      setBusy(false);
    }
  }

  function onProgramaElegido(id: string) {
    const p = programasMat.find((x) => idPrograma(x) === id);
    if (!p) {
      setProgSelId('');
      return;
    }
    seleccionarPrograma(p);
  }

  async function crearMatriculaPrograma() {
    if (!programaSel || !progSelId) {
      Alert.alert('Matrícula', 'Seleccione un programa.');
      return;
    }
    if (programaSoloVirtual) {
      Alert.alert(
        'Solo portal',
        'Este programa es solo virtual. El alumno debe matricularse en el portal; usted puede cobrar cuando aparezca la liquidación.',
      );
      return;
    }
    if (esTarifaVirtualSel) {
      const email = matriculaEmailPortal.trim() || alumnoCorreo;
      if (!email) {
        Alert.alert('Matrícula virtual', 'Indique el correo del portal (usuario de acceso).');
        return;
      }
    }

    const cuotasCustom =
      ajustarCuotasSemestre &&
      permitirAjusteCuotasSemestre &&
      !esTarifaVirtualSel &&
      numCuotasSemestre >= 2;
    let cuotasNumeros: number[] | null = null;
    if (cuotasCustom) {
      cuotasNumeros = resolverCuotasSemestreNumeros(valoresCuotasSemestre, numCuotasSemestre);
      if (!cuotasNumeros) {
        Alert.alert(
          'Cuotas por semestre',
          'Indique un valor entero en cada semestre (solo números, sin decimales).',
        );
        return;
      }
    }

    const catalogoBase = valorMatricula;
    const ajuste =
      ajustarValorMat && permitirAjusteValorMatricula && !esTarifaVirtualSel && !cuotasCustom;
    const acordado = ajuste ? valorAcordadoNum : catalogoBase;
    if (ajuste) {
      if (!Number.isFinite(acordado) || acordado < 0) {
        Alert.alert('Matrícula', 'Indique un valor acordado válido.');
        return;
      }
      if (acordado > catalogoBase) {
        Alert.alert('Matrícula', 'Solo se permiten rebajas sobre la matrícula (no incluye derechos de grado).');
        return;
      }
      if (acordado < catalogoBase && !motivoAjusteMat.trim()) {
        Alert.alert('Matrícula', 'Indique el motivo de la rebaja.');
        return;
      }
    }

    const valor = valorMatriculaTotal;
    Alert.alert(
      'Crear matrícula',
      `${labelPrograma(programaSel)}\n${etiquetaTarifa(tarifa)}\nValor: ${valor.toLocaleString('es-CO')}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Matricular',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const email = matriculaEmailPortal.trim() || alumnoCorreo;
                await crearMatricula({
                  numDoc,
                  idPrograma: progSelId,
                  tarifa,
                  ...(ajuste && acordado < catalogoBase
                    ? {
                        ajustarValor: true,
                        valorAcordado: acordado,
                        motivoAjuste: motivoAjusteMat.trim(),
                      }
                    : {}),
                  ...(cuotasCustom && cuotasNumeros
                    ? {
                        ajustarCuotasSemestre: true,
                        valoresCuotasSemestre: cuotasNumeros,
                        motivoAjusteCuotas: motivoAjusteCuotas.trim() || undefined,
                      }
                    : {}),
                  ...(esTarifaVirtualSel ? { crearUsuarioPortal: true, email } : {}),
                });
                const avisoCea = esProgramaCea(programaSel)
                  ? ' Programe las horas CEA en el módulo de programación.'
                  : '';
                Alert.alert('Listo', `Matrícula creada. Revise la pestaña Pagos.${avisoCea}`);
                setProgSelId('');
                setTarifa(1);
                setMatriculaEmailPortal('');
                limpiarAjustesMatricula();
                await load();
                setTab('pagos');
              } catch (e) {
                Alert.alert('Error', mensajeErrorApi(e));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  function seleccionarPrograma(p: ProgramaItem) {
    const id = idPrograma(p);
    setProgSelId(id);
    const servsProg = serviciosPrograma(p, servicios);
    const permitidas = tarifasPermitidasPrograma(p, servsProg);
    setTarifa((permitidas[0] ?? 1) as TarifaMatricula);
    setMatriculaEmailPortal('');
    limpiarAjustesMatricula();
  }

  function patchServicioDraft(id: string, patch: Partial<{ cantidad: string; valor: string }>) {
    setServiciosDraft((prev) => ({
      ...prev,
      [id]: { ...{ cantidad: '1', valor: '' }, ...prev[id], ...patch },
    }));
  }

  async function agregarServiciosSeleccionados() {
    if (!servSelIds.length) {
      Alert.alert('Servicio', 'Seleccione uno o más servicios adicionales.');
      return;
    }
    const filas: { id: string; servicio: ServicioItem; cant: number; valor: number; descripcion: string }[] = [];
    for (const id of servSelIds) {
      const servicio = serviciosAdicionales.find((s) => idServicio(s) === id);
      if (!servicio) continue;
      const draft = serviciosDraft[id] ?? { cantidad: '1', valor: '' };
      const cant = Math.max(1, Math.floor(Number(draft.cantidad.replace(/[^\d]/g, '') || '1')));
      const usaCant = permiteCantidadServicio(servicio);
      const valor = valorServicioAdicional(
        servicio,
        cant,
        Number(draft.valor.replace(/[^\d]/g, '') || '0'),
      );
      if (valor <= 0) {
        Alert.alert(
          'Servicio',
          `Revise el valor de «${servicio.descrServicio || servicio.descripcion}».`,
        );
        return;
      }
      const base = String(servicio.descrServicio || servicio.descripcion || '').trim();
      filas.push({
        id,
        servicio,
        cant,
        valor,
        descripcion: usaCant ? descrConCantidad(base, cant) : base,
      });
    }
    if (!filas.length) {
      Alert.alert('Servicio', 'No hay servicios válidos para agregar.');
      return;
    }
    setBusy(true);
    try {
      for (const f of filas) {
        await crearLiquidacion({
          numDoc,
          idServ: f.id,
          descripcion: f.descripcion || undefined,
          valor: f.valor,
          cantidad: permiteCantidadServicio(f.servicio) ? f.cant : undefined,
        });
      }
      Alert.alert('Listo', `${filas.length} servicio(s) agregado(s) a la cuenta del alumno.`);
      setServSelIds([]);
      setServiciosDraft({});
      await load();
      setTab('pagos');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo agregar');
    } finally {
      setBusy(false);
    }
  }

  async function emitirFacturaElegibles() {
    if (!elegiblesFe.length) {
      Alert.alert('Facturación', 'No hay ítems pagados elegibles para facturar.');
      return;
    }
    setBusy(true);
    try {
      const f = await emitirFactura({ numDoc, idLiquidaciones: elegiblesFe });
      const num = f.numeroFactura ?? 'Factura';
      Alert.alert('Factura emitida', num, [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: 'Imprimir',
          onPress: () =>
            nav.navigate('DocumentoViewer', {
              title: `Factura ${num}`,
              htmlPath: facturaHtmlPath(f._id),
            }),
        },
      ]);
      await load();
      setTab('comprobantes');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo emitir factura');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenBody refreshing={loading} onRefresh={() => { setLoading(true); void load(); }}>
      <AlumnoCard
        alumno={
          alumnoInfo ?? {
            _id: alumnoId || '',
            numDoc,
            nombreCompleto: displayNombre,
            correo: alumnoCorreo || undefined,
          }
        }
        saldo={totales.saldo}
        footer={
          <>
            <PrimaryButton
              label="Editar datos del alumno"
              icon="create-outline"
              variant="ghost"
              onPress={() =>
                nav.navigate('AlumnoEditar', {
                  alumnoId: alumnoId || undefined,
                  numDoc,
                  nombre: displayNombre,
                })
              }
              fullWidth
            />
            {certificados.length > 0 ? (
              <ScaledText baseSize={13} style={{ color: c.ok, marginTop: 10, fontWeight: '600', textAlign: 'center' }}>
                {certificados.length} certificado(s) emitido(s) — pestaña Certificados
              </ScaledText>
            ) : null}
          </>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && { backgroundColor: c.primary }]}
          >
            <ScaledText baseSize={13} style={{ color: tab === t.id ? '#fff' : c.text, fontWeight: '700' }}>
              {t.label}
            </ScaledText>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'pagos' ? (
        <>
          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>
            Cuenta por cobrar
          </ScaledText>
          {pendientes.length ? pendientes.map((item) => (
            <Pressable
              key={item._id}
              onPress={() => toggleItem(item)}
              style={[
                styles.itemRow,
                { borderColor: c.border, backgroundColor: itemSeleccionado(item._id) ? c.accentSoft : c.card },
              ]}
            >
              <Ionicons
                name={itemSeleccionado(item._id) ? 'checkbox' : 'square-outline'}
                size={22}
                color={c.primary}
              />
              <View style={{ flex: 1 }}>
                <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>{item.descripcion}</ScaledText>
                {esLiquidacionVirtual(item) ? (
                  <ScaledText baseSize={11} style={{ color: c.accent, fontWeight: '700', marginTop: 2 }}>
                    Matrícula virtual — pago total
                  </ScaledText>
                ) : null}
                <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 2 }}>
                  Saldo pendiente
                </ScaledText>
                <MoneyText value={item.saldo} baseSize={14} style={{ color: c.primary, marginTop: 2 }} />
              </View>
            </Pressable>
          )) : (
            <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 12 }}>Sin saldos pendientes.</ScaledText>
          )}
          {itemsPago.length ? (
            <View style={{ marginTop: 12, gap: 12 }}>
              <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700' }}>
                Valor a pagar
              </ScaledText>
              {itemsPago.map((it) => {
                const liq = liquidacionPorId(it.idLiquidacion);
                const virtual = liq ? esLiquidacionVirtual(liq) : false;
                return (
                <SurfaceCard key={it.idLiquidacion} elevated={false} style={{ padding: 12, gap: 8 }}>
                  <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>{it.descripcion}</ScaledText>
                  {virtual ? (
                    <ScaledText baseSize={11} style={{ color: c.accent, fontWeight: '700' }}>
                      Debe pagarse el saldo completo
                    </ScaledText>
                  ) : null}
                  <ScaledText baseSize={12} style={{ color: c.textSoft }}>
                    Saldo: {it.saldo.toLocaleString('es-CO')}
                  </ScaledText>
                  <View style={styles.valorRow}>
                    <TextInput
                      value={valorItemInput(it)}
                      onChangeText={(t) => setValorItem(it.idLiquidacion, t)}
                      keyboardType="number-pad"
                      placeholder="0"
                      editable={!virtual}
                      placeholderTextColor="#94a3b8"
                      style={[
                        styles.valorInput,
                        { borderColor: c.border, backgroundColor: virtual ? c.bg : c.card, color: c.text },
                      ]}
                    />
                    {!virtual ? (
                    <Pressable
                      onPress={() => pagarSaldoCompleto(it.idLiquidacion)}
                      style={[styles.totalBtn, { borderColor: c.primary, backgroundColor: c.accentSoft }]}
                    >
                      <ScaledText baseSize={13} style={{ color: c.primary, fontWeight: '700' }}>Total</ScaledText>
                    </Pressable>
                    ) : null}
                  </View>
                  {it.valor > 0 ? (
                    <ScaledText
                      baseSize={12}
                      style={{ color: esAbonoParcial(it) && !virtual ? c.warn : c.ok, fontWeight: '600' }}
                    >
                      {virtual || !esAbonoParcial(it) ? 'Pago total del ítem' : 'Abono parcial'}
                    </ScaledText>
                  ) : null}
                </SurfaceCard>
              );})}
              <PagoCobroFields
                idLiquidaciones={idsLiquidacionPago}
                subtotalItems={subtotalPago}
                value={pagoCobro}
                onChange={patchPagoCobro}
              />
              <PrimaryButton
                label="Registrar cobro"
                icon="cash-outline"
                onPress={() => void registrarPago()}
                disabled={busy || totalPago <= 0}
                fullWidth
              />
            </View>
          ) : null}
        </>
      ) : null}

      {tab === 'servicios' ? (
        <>
          <SurfaceCard style={{ marginBottom: 14 }}>
            <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 6 }}>
              Crear matrícula
            </ScaledText>
            <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 12, lineHeight: 18 }}>
              {programasMat.length} programas disponibles. Toque el campo, escriba para filtrar y elija uno.
            </ScaledText>
            <BuscarPickerField
              label="Programa"
              value={progSelId}
              options={opcionesProgramas}
              onChange={(id) => {
                if (!id) {
                  setProgSelId('');
                  limpiarAjustesMatricula();
                  return;
                }
                onProgramaElegido(id);
              }}
              placeholder="Buscar programa por nombre o código…"
              emptyText="No hay programas que coincidan"
              modalTitle="Elegir programa"
            />
            {programaSel ? (
              <View style={{ marginTop: 4, gap: 10 }}>
                {serviciosProgSel.length ? (
                  <View>
                    <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
                      Servicios incluidos en el programa
                    </ScaledText>
                    <View style={styles.chipRow}>
                      {serviciosProgSel.map((s) => (
                        <View key={idServicio(s)} style={[styles.chip, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
                          <ScaledText baseSize={11} style={{ color: c.text }}>
                            {s.descrServicio || s.descripcion}
                          </ScaledText>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {programaSoloVirtual ? (
                  <ScaledText baseSize={13} style={{ color: c.warn, lineHeight: 18 }}>
                    Programa solo virtual: el alumno debe matricularse en el portal. Puede cobrar la liquidación en Pagos.
                  </ScaledText>
                ) : null}
                <View style={styles.tarifaRow}>
                  {tarifasPermitidas.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => {
                        setTarifa(t as TarifaMatricula);
                        if (t === TARIFA_VIRTUAL && !matriculaEmailPortal && alumnoCorreo) {
                          setMatriculaEmailPortal(alumnoCorreo);
                        }
                        if (ajustarCuotasSemestre) {
                          setValoresCuotasSemestre(
                            cuotasSemestreCatalogo(
                              serviciosPrograma(programaSel, servicios),
                              t as TarifaMatricula,
                            ).map((v) => Math.round(v)),
                          );
                        }
                        if (ajustarValorMat) {
                          setValorAcordadoMat(
                            String(
                              Math.round(
                                calcularValorMatricula(programaSel, servicios, t as TarifaMatricula),
                              ),
                            ),
                          );
                        }
                      }}
                      style={[
                        styles.tarifaChip,
                        {
                          borderColor: c.primary,
                          backgroundColor: tarifa === t ? c.primary : c.card,
                        },
                      ]}
                    >
                      <ScaledText
                        baseSize={13}
                        style={{ color: tarifa === t ? '#fff' : c.primary, fontWeight: '700' }}
                      >
                        {etiquetaTarifa(t)}
                      </ScaledText>
                    </Pressable>
                  ))}
                </View>
                {esTarifaVirtualSel && !programaSoloVirtual ? (
                  <>
                    <ScaledText baseSize={13} style={{ color: c.textSoft }}>
                      Correo portal (acceso aula virtual)
                    </ScaledText>
                    <TextInput
                      value={matriculaEmailPortal}
                      onChangeText={setMatriculaEmailPortal}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder={alumnoCorreo || 'correo@ejemplo.com'}
                      placeholderTextColor="#94a3b8"
                      style={[styles.valorInput, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
                    />
                  </>
                ) : null}
                <MatriculaAjustePanel
                  c={c}
                  serviciosProg={serviciosProgSel}
                  valorMatriculaBase={valorMatricula}
                  totalExtrasMatricula={totalExtrasMatricula}
                  numCuotasSemestre={numCuotasSemestre}
                  cuotasCatalogo={cuotasCatalogo}
                  permitirRebaja={permitirAjusteValorMatricula}
                  permitirCuotas={permitirAjusteCuotasSemestre}
                  esTarifaVirtual={esTarifaVirtualSel}
                  ajustarValorMat={ajustarValorMat}
                  onAjustarValorMatChange={onAjustarValorMatChange}
                  valorAcordadoMat={valorAcordadoMat}
                  onValorAcordadoMatChange={setValorAcordadoMat}
                  motivoAjusteMat={motivoAjusteMat}
                  onMotivoAjusteMatChange={setMotivoAjusteMat}
                  rebajaMatricula={rebajaMatricula}
                  ajustarCuotasSemestre={ajustarCuotasSemestre}
                  onAjustarCuotasSemestreChange={onAjustarCuotasSemestreChange}
                  valoresCuotasSemestre={valoresCuotasSemestre}
                  onCuotaSemestreChange={onCuotaSemestreChange}
                  motivoAjusteCuotas={motivoAjusteCuotas}
                  onMotivoAjusteCuotasChange={setMotivoAjusteCuotas}
                  totalCuotasSemestre={totalCuotasSemestre}
                  onRepartirEquitativo={() => {
                    const n = valoresCuotasSemestre.length || numCuotasSemestre;
                    const total = totalCuotasSemestre || valorMatricula;
                    setValoresCuotasSemestre(repartirCuotasEquitativo(total, n));
                  }}
                  onRestaurarCatalogo={() => setValoresCuotasSemestre(cuotasDesdeCatalogo())}
                  cuotaSemestreInvalida={cuotaSemestreInvalida}
                />
                <View style={styles.valorMatRow}>
                  <ScaledText baseSize={13} style={{ color: c.textSoft }}>Valor matrícula</ScaledText>
                  <MoneyText value={valorMatriculaTotal} baseSize={16} style={{ color: c.primary }} bold />
                </View>
                {extrasMatricula.length ? (
                  <ScaledText baseSize={12} style={{ color: c.textSoft }}>
                    {extrasMatricula.map((ex) => `${ex.descripcion}: ${Number(ex.valor).toLocaleString('es-CO')}`).join(' · ')}
                  </ScaledText>
                ) : null}
                <PrimaryButton
                  label="Crear matrícula"
                  icon="school-outline"
                  onPress={() => void crearMatriculaPrograma()}
                  disabled={busy || programaSoloVirtual}
                  fullWidth
                />
              </View>
            ) : null}
          </SurfaceCard>

          {combos.length ? (
            <SurfaceCard style={{ marginBottom: 14 }}>
              <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 6 }}>
                Aplicar combo de cursos
              </ScaledText>
              <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 12, lineHeight: 18 }}>
                Un combo aplica Tarifa 2 a varios cursos presenciales en un solo paso. Se crea una matrícula y
                liquidación por cada curso incluido.
              </ScaledText>
              <BuscarPickerField
                label="Combo"
                value={comboSelId}
                options={opcionesCombos}
                onChange={(id) => void onComboElegido(id)}
                placeholder="Buscar y elegir combo de cursos…"
                emptyText="No hay combos que coincidan"
                modalTitle="Elegir combo"
              />
              {comboPrevista ? (
                <View style={[styles.comboPrevista, { borderColor: c.border, backgroundColor: c.bgAlt }]}>
                  <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
                    {comboPrevista.nombre}
                  </ScaledText>
                  {comboPrevista.programas.map((p) => (
                    <View key={p.idPrograma} style={styles.comboProgRow}>
                      <ScaledText baseSize={13} style={{ color: c.text, flex: 1 }} numberOfLines={2}>
                        {p.nombreProg}
                      </ScaledText>
                      <ScaledText baseSize={13} style={{ color: c.primary, fontWeight: '700' }}>
                        ${Math.round(p.valor).toLocaleString('es-CO')}
                      </ScaledText>
                    </View>
                  ))}
                  <View style={[styles.valorMatRow, { marginTop: 10 }]}>
                    <ScaledText baseSize={13} style={{ color: c.textSoft }}>Total Tarifa 2</ScaledText>
                    <MoneyText value={comboPrevista.totalValor} baseSize={16} style={{ color: c.primary }} bold />
                  </View>
                </View>
              ) : null}
              {comboResultado ? (
                <View
                  style={[
                    styles.comboPrevista,
                    {
                      borderColor: comboResultado.errores.length ? c.warn : c.ok,
                      backgroundColor: comboResultado.errores.length ? c.warnBg : c.okBg,
                      marginTop: comboPrevista ? 10 : 0,
                    },
                  ]}
                >
                  <ScaledText baseSize={13} style={{ color: c.text, marginBottom: 6 }}>
                    {comboResultado.message}
                  </ScaledText>
                  {comboResultado.resultados.map((r) => (
                    <ScaledText key={r.idPrograma} baseSize={12} style={{ color: c.ok, marginTop: 2 }}>
                      ✓ {r.nombreProg} — ${Math.round(r.valor).toLocaleString('es-CO')}
                    </ScaledText>
                  ))}
                  {comboResultado.errores.map((e) => (
                    <ScaledText key={e.idPrograma} baseSize={12} style={{ color: c.danger, marginTop: 2 }}>
                      ✗ {e.nombreProg}: {e.error}
                    </ScaledText>
                  ))}
                </View>
              ) : null}
              {comboSelId ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <PrimaryButton
                    label="Aplicar combo"
                    icon="layers-outline"
                    onPress={() => void aplicarComboAlumno()}
                    disabled={busy || !comboPrevista}
                    fullWidth
                  />
                  <PrimaryButton
                    label="Cancelar"
                    variant="ghost"
                    onPress={limpiarCombo}
                    disabled={busy}
                    fullWidth
                  />
                </View>
              ) : null}
            </SurfaceCard>
          ) : null}

          <SurfaceCard>
            <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 6 }}>
              Servicios adicionales
            </ScaledText>
            <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 12, lineHeight: 18 }}>
              Puede elegir varios a la vez. Escriba para filtrar por nombre o programa.
            </ScaledText>
            <BuscarPickerField
              multiple
              label="Servicios a agregar"
              value={servSelIds}
              options={opcionesServicios}
              onChange={setServSelIds}
              placeholder="Buscar y marcar uno o varios servicios…"
              emptyText="Sin servicios adicionales que coincidan"
              modalTitle="Elegir servicios adicionales"
            />
            {servSelIds.length ? (
              <View style={{ marginTop: 8, gap: 10 }}>
                {servSelIds.map((id) => {
                  const servicio = serviciosAdicionales.find((s) => idServicio(s) === id);
                  if (!servicio) return null;
                  const draft = serviciosDraft[id] ?? { cantidad: '1', valor: '' };
                  const usaCant = permiteCantidadServicio(servicio);
                  const valor = valorServicioAdicional(
                    servicio,
                    Number(draft.cantidad.replace(/[^\d]/g, '') || '1'),
                    Number(draft.valor.replace(/[^\d]/g, '') || '0'),
                  );
                  return (
                    <View
                      key={id}
                      style={[styles.draftRow, { borderColor: c.border, backgroundColor: c.bgAlt }]}
                    >
                      <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
                        {servicio.descrServicio || servicio.descripcion}
                      </ScaledText>
                      {usaCant ? (
                        <>
                          <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 4 }}>
                            {/\bhoras?\b.*\bpractic/i.test(String(servicio.descrServicio || ''))
                              ? 'Cantidad (horas)'
                              : 'Cantidad'}
                          </ScaledText>
                          <TextInput
                            value={draft.cantidad}
                            onChangeText={(t) => patchServicioDraft(id, { cantidad: t.replace(/[^\d]/g, '') })}
                            keyboardType="number-pad"
                            style={[styles.valorInput, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
                          />
                        </>
                      ) : (
                        <>
                          <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 4 }}>
                            Valor a cobrar
                          </ScaledText>
                          <TextInput
                            value={draft.valor}
                            onChangeText={(t) => patchServicioDraft(id, { valor: t.replace(/[^\d]/g, '') })}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor="#94a3b8"
                            style={[styles.valorInput, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
                          />
                        </>
                      )}
                      <View style={styles.valorMatRow}>
                        <ScaledText baseSize={12} style={{ color: c.textSoft }}>Subtotal</ScaledText>
                        <MoneyText value={valor} baseSize={15} style={{ color: c.primary }} bold />
                      </View>
                    </View>
                  );
                })}
                <PrimaryButton
                  label={`Agregar ${servSelIds.length} servicio(s)`}
                  icon="construct-outline"
                  onPress={() => void agregarServiciosSeleccionados()}
                  disabled={busy}
                  fullWidth
                />
              </View>
            ) : null}
          </SurfaceCard>
        </>
      ) : null}

      {tab === 'comprobantes' ? (
        <>
          {elegiblesFe.length ? (
            <View style={{ marginBottom: 14 }}>
              <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 8 }}>
                {elegiblesFe.length} ítem(s) listo(s) para factura electrónica
              </ScaledText>
              <PrimaryButton
                label="Emitir factura"
                icon="receipt-outline"
                onPress={() => void emitirFacturaElegibles()}
                disabled={busy}
                fullWidth
              />
            </View>
          ) : null}

          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>
            Recibos de pago
          </ScaledText>
          {pagos.length ? pagos.map((p) => (
            <View key={p._id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.card }]}>
              <View style={{ flex: 1 }}>
                <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>
                  Recibo #{p.numRecibo ?? '—'}
                </ScaledText>
                <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 4 }}>
                  {p.fecha ? new Date(p.fecha).toLocaleString('es-CO') : ''} · {p.tipoPagoDescr ?? p.formaPago}
                </ScaledText>
                <MoneyText value={p.valor} baseSize={14} style={{ color: c.ok, marginTop: 4 }} bold />
              </View>
              <VerDocumentoButton
                titulo={`Recibo ${p.numRecibo ?? p._id}`}
                htmlPath={reciboIngresoHtmlPath(p._id)}
              />
            </View>
          )) : (
            <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 16 }}>Sin recibos de pago.</ScaledText>
          )}

          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 8, marginTop: 8 }}>
            Facturas electrónicas
          </ScaledText>
          {facturas.length ? facturas.map((f) => (
            <View key={f._id} style={[styles.itemRow, { borderColor: c.border, backgroundColor: c.card }]}>
              <View style={{ flex: 1 }}>
                <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>
                  {f.numeroFactura ?? 'Factura'}
                </ScaledText>
                <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 4 }}>
                  {f.estado ?? '—'}
                  {f.emitidaAt ? ` · ${new Date(f.emitidaAt).toLocaleDateString('es-CO')}` : ''}
                </ScaledText>
                <MoneyText value={f.valorTotal} baseSize={14} style={{ color: c.primary, marginTop: 4 }} bold />
              </View>
              <VerDocumentoButton
                titulo={`Factura ${f.numeroFactura ?? f._id}`}
                htmlPath={facturaHtmlPath(f._id)}
              />
            </View>
          )) : (
            <ScaledText baseSize={14} style={{ color: c.textSoft }}>Sin facturas emitidas para este alumno.</ScaledText>
          )}
        </>
      ) : null}

      {tab === 'certificados' ? (
        <>
          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>
            Certificados expedidos
          </ScaledText>
          {certErr && !certificados.length ? (
            <ScaledText baseSize={14} style={{ color: c.textSoft, lineHeight: 20, marginBottom: 12 }}>
              {certErr}. Se requiere permiso de certificados en el rol del usuario.
            </ScaledText>
          ) : null}
          {certificados.length ? certificados.map((cert) => (
            <CertificadoFila key={cert._id} cert={cert} />
          )) : !certErr ? (
            <ScaledText baseSize={14} style={{ color: c.textSoft }}>Sin certificados expedidos.</ScaledText>
          ) : null}
        </>
      ) : null}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  saldoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14, paddingRight: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#e2e8f0' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  valorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valorInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  totalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tarifaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tarifaChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  valorMatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  draftRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  comboPrevista: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  comboProgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
});
