import type { AlumnoCrearDto, AlumnoDetalleItem } from '../api/domain';
import { TIPO_ALUMNO_DEFAULT } from './alumnoCatalogo';

function fechaAString(v?: string | Date | null): string {
  if (!v) return '';
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return v.slice(0, 10);
  }
  if (!Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return '';
}

export function alumnoDetalleToForm(a: AlumnoDetalleItem): {
  form: AlumnoCrearDto;
  expedidaTexto: string;
  munOrigenTexto: string;
  empresaNombre: string;
} {
  const freq = a.alertaPagoFrecuencia;
  return {
    form: {
      tipoAlumno: a.tipoAlumno || TIPO_ALUMNO_DEFAULT,
      tipoDoc: a.tipoDoc || '1',
      numDoc: a.numDoc != null ? String(a.numDoc).replace(/\D/g, '') : '',
      expedida: a.expedida || '',
      apellido1: a.apellido1 || '',
      apellido2: a.apellido2 || '',
      nombre1: a.nombre1 || '',
      nombre2: a.nombre2 || '',
      fechaNac: fechaAString(a.fechaNac),
      observaciones: a.observaciones || '',
      genero: a.genero || '',
      tipoSangre: a.tipoSangre || '',
      jornada: a.jornada || '',
      estadoCivil: a.estadoCivil || '',
      estrato: a.estrato || '',
      regimenSalud: a.regimenSalud || '',
      nivelFormacion: a.nivelFormacion || '',
      ocupacion: a.ocupacion || '',
      discapacidad: a.discapacidad || '9',
      munOrigen: a.munOrigen || a.codMunicipio || '',
      codMunicipio: a.codMunicipio || a.munOrigen || '',
      correo: a.correo || '',
      direccion: a.direccion || '',
      celular: a.celular || '',
      multiCulturalidad: a.multiCulturalidad || 'NO_APLICA',
      empresaId: a.empresaId ?? null,
      alertaPagoFrecuencia: freq === 'mensual' || freq === 'quincenal' ? freq : '',
      alertaPago: fechaAString(a.alertaPago),
    },
    expedidaTexto: a.expedida?.trim() || '',
    munOrigenTexto: a.munOrigen || a.codMunicipio || '',
    empresaNombre: a.empresaNombre?.trim() || '',
  };
}
