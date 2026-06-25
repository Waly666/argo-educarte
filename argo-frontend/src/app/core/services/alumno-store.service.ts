import { Injectable, computed, signal } from '@angular/core';

import type { AlumnoDto } from './alumno.service';
import { formatNumDoc } from '../utils/num-doc.helpers';

@Injectable({ providedIn: 'root' })
export class AlumnoStore {
  private _alumno = signal<AlumnoDto | null>(null);
  private _liqTick = signal(0);

  alumno = computed(() => this._alumno());
  hasAlumno = computed(() => !!this._alumno()?._id);
  numDoc = computed(() => this._alumno()?.numDoc ?? null);
  liqTick = computed(() => this._liqTick());

  nombreCompleto = computed(() => {
    const a = this._alumno();
    if (!a) return null;
    const ap = [a.apellido1, a.apellido2].filter(Boolean).join(' ').trim();
    const n = [a.nombre1, a.nombre2].filter(Boolean).join(' ').trim();
    return [ap, n].filter(Boolean).join(' ').trim() || null;
  });

  setAlumno(a: AlumnoDto | null) {
    if (!a) {
      this._alumno.set(null);
      return;
    }
    const copy = { ...a } as AlumnoDto & Record<string, unknown>;
    if (copy._id != null) copy._id = String(copy._id);
    if (copy.numDoc != null) copy.numDoc = formatNumDoc(copy.numDoc);
    if (!String(copy.nombre1 || '').trim() && copy['nombres']) {
      const p = String(copy['nombres']).trim().split(/\s+/).filter(Boolean);
      copy.nombre1 = p[0] || '';
      copy.nombre2 = copy.nombre2 || p.slice(1).join(' ');
    }
    if (!String(copy.apellido1 || '').trim() && copy['apellidos']) {
      const p = String(copy['apellidos']).trim().split(/\s+/).filter(Boolean);
      copy.apellido1 = p[0] || '';
      copy.apellido2 = copy.apellido2 || p.slice(1).join(' ');
    }
    this._alumno.set(copy);
  }

  clear() {
    this._alumno.set(null);
    this._liqTick.set(0);
    this._datosSinGuardar.set(false);
  }

  touchLiquidacion() {
    this._liqTick.update((n) => n + 1);
  }

  /** Datos principales con cambios aún no guardados en BD */
  private _datosSinGuardar = signal(false);
  datosSinGuardar = computed(() => this._datosSinGuardar());

  setDatosSinGuardar(v: boolean) {
    this._datosSinGuardar.set(v);
  }

  /** Pulso para avisar junto al botón Guardar/Crear (p. ej. al intentar cambiar de pestaña) */
  private _saveAlarmTick = signal(0);
  saveAlarmTick = computed(() => this._saveAlarmTick());

  pulseSaveAlarm() {
    this._saveAlarmTick.update((n) => n + 1);
  }
}
