export interface ResumenCaja {
  idSesion: number;
  usuario?: string;
  nombreCajero?: string;
  estado?: string;
  fechaApertura: string;
  fechaCierre?: string;
  saldoInicial: number;
  totalIngresos: number;
  totalIngresosEfectivo?: number;
  totalEgresos: number;
  saldoTeorico: number;
  efectivoEsperado?: number;
  cantidadIngresos: number;
  cantidadEgresos: number;
}

export interface CajaSesion {
  idSesion: number;
  idSede?: string | null;
  sedeNombre?: string | null;
  estado: 'abierta' | 'cerrada';
  usuario?: string;
  nombreCaja?: string;
  fechaApertura: string;
  fechaCierre?: string;
  saldoInicial: number;
  efectivoContado?: number | null;
  diferencia?: number | null;
  resumen?: ResumenCaja;
}

export interface CajaActivaFull {
  abierta: boolean;
  sesion: CajaSesion | null;
  resumenParcial?: ResumenCaja;
}

export interface CierreCajaResponse {
  sesion: CajaSesion;
  resumen: ResumenCaja;
  descuadre?: Record<string, unknown> | null;
}

export interface AlumnoListItem {
  _id: string;
  numDoc: number | string;
  tipoDoc?: string;
  nombre1?: string;
  nombre2?: string;
  apellido1?: string;
  apellido2?: string;
  nombreCompleto?: string;
  correo?: string;
  celular?: string;
  empresaId?: string | null;
  empresaNombre?: string | null;
  indicadores?: {
    saldosPendientes?: number;
    saldoTotal?: number;
  };
}

/** Ficha completa del alumno (GET /alumnos/:id). */
export interface AlumnoDetalleItem extends AlumnoListItem {
  tipoAlumno?: string;
  expedida?: string;
  fechaNac?: string;
  observaciones?: string;
  genero?: string;
  tipoSangre?: string;
  jornada?: string;
  estadoCivil?: string;
  estrato?: string;
  regimenSalud?: string;
  nivelFormacion?: string;
  ocupacion?: string;
  discapacidad?: string;
  munOrigen?: string;
  codMunicipio?: string;
  direccion?: string;
  multiCulturalidad?: string;
  empresaId?: string | null;
  empresaNombre?: string | null;
  alertaPago?: string | null;
  alertaPagoFrecuencia?: '' | 'mensual' | 'quincenal' | null;
  urlFoto?: string;
  urlCedula?: string;
  urlLicencia?: string;
}

export interface AlumnoCrearDto {
  tipoAlumno?: string;
  tipoDoc?: string;
  numDoc: number | string;
  expedida?: string;
  nombre1: string;
  nombre2?: string;
  apellido1: string;
  apellido2?: string;
  fechaNac?: string;
  observaciones?: string;
  genero?: string;
  tipoSangre?: string;
  jornada?: string;
  estadoCivil?: string;
  estrato?: string;
  regimenSalud?: string;
  nivelFormacion?: string;
  ocupacion?: string;
  discapacidad?: string;
  munOrigen?: string;
  codMunicipio?: string;
  celular?: string;
  correo?: string;
  direccion?: string;
  multiCulturalidad?: string;
  empresaId?: string | null;
  alertaPagoFrecuencia?: '' | 'mensual' | 'quincenal';
  alertaPago?: string;
  esJornadaCap?: string;
}

export interface AlumnoDocVerificacion {
  existe: boolean;
  _id?: string;
  numDoc?: number | string;
  nombreCompleto?: string;
}

export interface AlumnosListResponse {
  items: AlumnoListItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface LiquidacionItem {
  _id: string;
  numDoc: number | string;
  descripcion?: string;
  valor: number;
  abonado: number;
  saldo: number;
  estado?: string;
  idServ?: string | null;
  idProg?: string | null;
  idMat?: string | null;
  esVirtual?: boolean;
  tarifaMatricula?: number | null;
}

export interface LiquidacionResumen {
  items: LiquidacionItem[];
  totales: { valor: number; abonado: number; saldo: number };
}

export interface LiquidacionConSaldoItem extends LiquidacionItem {
  alumnoNombre?: string;
  alumnoDoc?: number | string;
}

export interface LiquidacionConSaldoResumen {
  items: LiquidacionConSaldoItem[];
  total: number;
  totales: { valor: number; abonado: number; saldo: number };
}

export interface IngresoItemPago {
  idLiquidacion: string;
  valor: number;
}

export interface IngresoCrearDto {
  numDoc: number | string;
  idLiquidacion?: string;
  valor?: number;
  items?: IngresoItemPago[];
  idTipoPago: string;
  idCuentaBancaria?: string;
  numComprobante?: string;
  observaciones?: string;
}

export interface IngresoRow {
  _id: string;
  numRecibo?: string | null;
  valor: number;
  fecha?: string;
  tipoPagoDescr?: string;
  formaPago?: string;
  detalle?: { descripcion?: string; valor?: number }[];
}

export interface CatalogoItem {
  _id?: string;
  idTipoPago?: string;
  idTipoDoc?: string;
  idGenero?: string;
  idJornada?: string;
  idEstadoCivil?: string;
  idEstrato?: string;
  idRegimen?: string;
  idNivel?: string;
  idOcupacion?: string;
  idDiscapacidad?: string;
  id?: string;
  codigo?: string;
  descripcion?: string;
  idCuentaBancaria?: string;
  nombre?: string;
  banco?: string;
  [key: string]: unknown;
}

export interface ProgramaItem {
  _id?: string;
  idPrograma: number | string;
  idProg?: number | string;
  codigoProg?: string;
  nombreProg: string;
  descripcion?: string;
  nomCert?: string;
  valorMatricula?: number;
  idTipCap?: string | number;
  tipoCertificado?: string;
  tipoCap?: string;
  semestres?: number;
  idServ?: string | number;
  horasTeoria?: number;
  horasPractica?: number;
  horasTaller?: number;
  horas?: number;
  tarifa1?: number;
  tarifa2?: number;
  tarifa3?: number;
  tarifaVirtual?: number;
  modalidades?: string[];
  tarifasPermitidas?: number[];
  soloVirtual?: boolean;
  admiteVirtual?: boolean;
  admitePresencial?: boolean;
  estado?: string;
  esCapacitacionVirtual?: boolean;
  modalidadLabels?: string[];
}

export interface ServicioItem {
  _id?: string;
  idServ?: number | string;
  idProg?: string | number | null;
  descrServicio?: string;
  descripcion?: string;
  tarifa1?: number;
  tarifa2?: number;
  tarifa3?: number;
  tarifaVirtual?: number;
  programaNombre?: string | null;
  programaCodigo?: string | null;
  tipoServ?: string | number;
  rolServicio?: string;
  facturar?: string;
  usaCantidad?: boolean;
  permiteCantidad?: boolean;
  valorVariable?: boolean;
}

export interface FacturacionResumen {
  emitidas: number;
  validadas: number;
  rechazadas: number;
  listoParaFactus?: boolean;
}

export interface FacturaElectronicaItem {
  _id: string;
  numeroFactura?: string;
  estado?: string;
  valorTotal?: number;
  numDoc?: number;
  emitidaAt?: string;
  adquirente?: { nombre?: string };
}

export interface FacturasListResponse {
  items: FacturaElectronicaItem[];
  total: number;
}

export interface CertificadoItem {
  _id: string;
  codigoCert?: string;
  numDoc?: number | string;
  alumnoId?: string | null;
  nombreCompleto?: string;
  encabezado?: string;
  tipoFormatoCert?: string;
  tipoFormatoCertLabel?: string;
  programaDescr?: string | null;
  nomCert?: string | null;
  fechaEmision?: string;
  fechaVencimiento?: string | null;
  estado?: string;
  numActa?: string;
  numFolio?: string;
  empresaId?: string | null;
  empresaNombre?: string | null;
  codVerificacion?: string | null;
}

export interface CertificadoListadoRes {
  total: number;
  emitidosHoy: number;
  items: CertificadoItem[];
}

export interface LiquidacionElegibleFe {
  _id: string;
  descripcion?: string;
  abonado: number;
  saldo: number;
}
