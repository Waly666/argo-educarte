import { Injectable, signal } from '@angular/core';

export type JornadaLiveToastKind = 'clase' | 'jornada' | 'clase-inicio' | 'clase-fin';

export interface JornadaLiveToast {
  id: string;
  kind: JornadaLiveToastKind;
  titulo: string;
  detalle: string;
}

const TOAST_MS = 3000;

@Injectable({ providedIn: 'root' })
export class JornadaLiveSyncService {
  private clasesConocidas = new Set<string>();
  private jornadasConocidas = new Set<string>();
  private claseEstados = new Map<string, string>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private pollListo = false;

  private readonly _toast = signal<JornadaLiveToast | null>(null);
  private readonly _refreshTick = signal(0);

  readonly toast = this._toast.asReadonly();
  readonly refreshTick = this._refreshTick.asReadonly();

  marcarPollInicializado() {
    this.pollListo = true;
  }

  pollEstaListo(): boolean {
    return this.pollListo;
  }

  marcarClasesConocidas(ids: Array<string | undefined | null>) {
    for (const id of ids) {
      const k = String(id || '');
      if (k) this.clasesConocidas.add(k);
    }
  }

  marcarJornadasConocidas(ids: Array<string | undefined | null>) {
    for (const id of ids) {
      const k = String(id || '');
      if (k) this.jornadasConocidas.add(k);
    }
  }

  sincronizarEstadosClases(clases: Array<Record<string, unknown> | { _id?: string; estado?: string }>) {
    for (const c of clases || []) {
      const id = String(c._id || (c as Record<string, unknown>)['_id'] || '');
      if (!id) continue;
      this.claseEstados.set(id, this.normEstado(String(c.estado || (c as Record<string, unknown>)['estado'] || '')));
    }
  }

  registrarClaseLocal(clase: { _id?: string; estado?: string }) {
    const id = String(clase?._id || '');
    if (!id) return;
    this.clasesConocidas.add(id);
    this.claseEstados.set(id, this.normEstado(String(clase.estado || '')));
  }

  registrarJornadasLocales(jornadas: Array<{ _id?: string }>) {
    for (const j of jornadas || []) this.registrarJornadaLocal(j);
  }

  registrarJornadaLocal(jornada: { _id?: string }) {
    const id = String(jornada?._id || '');
    if (id) this.jornadasConocidas.add(id);
  }

  procesarPoll(clases: Array<Record<string, unknown>>, jornadas: Array<Record<string, unknown>>) {
    let hayCambio = false;

    for (const j of jornadas || []) {
      const id = String(j['_id'] || '');
      if (!id || this.jornadasConocidas.has(id)) continue;
      this.jornadasConocidas.add(id);
      hayCambio = true;
      this.mostrarToastJornada(j);
    }

    for (const c of clases || []) {
      const id = String(c['_id'] || '');
      if (!id) continue;

      if (!this.clasesConocidas.has(id)) {
        this.clasesConocidas.add(id);
        this.claseEstados.set(id, this.normEstado(String(c['estado'] || '')));
        hayCambio = true;
        this.mostrarToastClase(c);
        continue;
      }

      if (this.detectarCambioEstadoClase(c)) hayCambio = true;
    }

    if (hayCambio) this._refreshTick.update((n) => n + 1);
  }

  notificarClaseIniciada(clase: Record<string, unknown> | { _id?: string; estado?: string; programaNombre?: string; instructorNombre?: string; idPrograma?: string; idinstructor?: string }) {
    const c = clase as Record<string, unknown>;
    const id = String(c['_id'] || '');
    if (id) this.claseEstados.set(id, 'EN PROCESO');
    this.mostrarToastClaseIniciada(c);
    this._refreshTick.update((n) => n + 1);
  }

  notificarClaseFinalizada(clase: Record<string, unknown> | { _id?: string; estado?: string; duracionSegundos?: number | null; programaNombre?: string; instructorNombre?: string; idPrograma?: string; idinstructor?: string }) {
    const c = clase as Record<string, unknown>;
    const id = String(c['_id'] || '');
    if (id) this.claseEstados.set(id, 'FINALIZADO');
    this.mostrarToastClaseFinalizada(c);
    this._refreshTick.update((n) => n + 1);
  }

  mostrarToastClase(c: Record<string, unknown>) {
    this.mostrarToast({
      id: `clase-nueva-${c['_id']}-${Date.now()}`,
      kind: 'clase',
      titulo: 'Se creó una clase',
      detalle: this.detalleClase(c),
    });
  }

  mostrarToastClaseIniciada(c: Record<string, unknown>) {
    this.mostrarToast({
      id: `clase-inicio-${c['_id']}-${Date.now()}`,
      kind: 'clase-inicio',
      titulo: 'Clase iniciada',
      detalle: this.detalleClase(c),
    });
  }

  mostrarToastClaseFinalizada(c: Record<string, unknown>) {
    const dur = c['duracionSegundos'];
    const extra =
      dur != null && Number(dur) >= 0 ? `Duración: ${this.fmtDuracion(Number(dur))}` : undefined;
    this.mostrarToast({
      id: `clase-fin-${c['_id']}-${Date.now()}`,
      kind: 'clase-fin',
      titulo: 'Clase finalizada',
      detalle: this.detalleClase(c, extra),
    });
  }

  mostrarToastJornada(j: Record<string, unknown>) {
    const fecha = j['fechaProgramacion'] ? this.fmtFecha(String(j['fechaProgramacion'])) : '';
    const municipio = String(j['municipio'] || '').trim();
    const detalle = [fecha, municipio].filter(Boolean).join(' · ') || 'Nueva jornada en el contrato';
    this.mostrarToast({
      id: `jornada-${j['_id']}-${Date.now()}`,
      kind: 'jornada',
      titulo: 'Se programó una jornada',
      detalle,
    });
  }

  mostrarToastGeneracionJornadas(cantidad: number) {
    this.mostrarToast({
      id: `jornadas-gen-${Date.now()}`,
      kind: 'jornada',
      titulo: 'Jornadas generadas',
      detalle: `${cantidad} jornada(s) creada(s) en el contrato`,
    });
    this._refreshTick.update((n) => n + 1);
  }

  private detectarCambioEstadoClase(c: Record<string, unknown>): boolean {
    const id = String(c['_id'] || '');
    if (!id) return false;
    const estado = this.normEstado(String(c['estado'] || ''));
    const prev = this.claseEstados.get(id) || 'PROGRAMADA';

    if (prev === estado) return false;
    this.claseEstados.set(id, estado);

    if (estado === 'EN PROCESO' && prev !== 'EN PROCESO') {
      this.mostrarToastClaseIniciada(c);
      return true;
    }
    if (estado === 'FINALIZADO' && prev !== 'FINALIZADO') {
      this.mostrarToastClaseFinalizada(c);
      return true;
    }
    return true;
  }

  private detalleClase(c: Record<string, unknown>, extra?: string): string {
    const programa = String(
      c['programaNombre'] || c['nombreProg'] || c['idPrograma'] || 'Programa',
    ).trim();
    const instructor = String(c['instructorNombre'] || c['idinstructor'] || '—').trim();
    const base = `${programa} · Instructor: ${instructor}`;
    return extra ? `${base} · ${extra}` : base;
  }

  private normEstado(estado: string): string {
    return String(estado || 'PROGRAMADA').trim().toUpperCase();
  }

  private fmtDuracion(seg: number): string {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }

  private mostrarToast(toast: JornadaLiveToast) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this._toast.set(toast);
    this.toastTimer = setTimeout(() => {
      this._toast.set(null);
      this.toastTimer = null;
    }, TOAST_MS);
  }

  private fmtFecha(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
