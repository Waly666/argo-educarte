import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { ASISTENTE_CATALOGO, contextoAsistente } from '../constants/asistente.catalogo';
import type { AsistenteContexto, AsistenteTip } from '../constants/asistente.types';

const LS_ACTIVO = 'argo.asistente.activo';
const LS_SONIDO = 'argo.asistente.sonido';

@Injectable({ providedIn: 'root' })
export class AsistenteContextoService {
  private router = inject(Router);

  /** Override desde modales (emitir factura, nota crédito, etc.). */
  private overrideId = signal<string | null>(null);
  /** Tips de formulario activo — se muestran primero en Mia (contexto del modal). */
  private tipsPrepend = signal<AsistenteTip[]>([]);

  activo = signal(this.readBool(LS_ACTIVO, true));
  sonido = signal(this.readBool(LS_SONIDO, true));
  /** Panel de tips abierto (false = solo avatar). */
  expandido = signal(false);

  contextoId = signal<string | null>(null);

  contexto = computed<AsistenteContexto | null>(() => {
    const id = this.overrideId() || this.contextoId();
    const base = contextoAsistente(id);
    if (!base) return null;
    const prep = this.tipsPrepend();
    if (!prep.length) return base;
    return { ...base, tips: [...prep, ...base.tips] };
  });

  visible = computed(() => this.activo() && !!this.contexto());

  indiceTip = signal(0);

  tipActual = computed(() => {
    const ctx = this.contexto();
    if (!ctx?.tips.length) return null;
    const i = this.indiceTip() % ctx.tips.length;
    return ctx.tips[i];
  });

  constructor() {
    this.resolverDesdeUrl(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.overrideId.set(null);
        const prev = this.contextoId();
        this.resolverDesdeUrl(e.urlAfterRedirects);
        const next = this.contextoId();
        if (next && next !== prev && this.activo() && this.sonido()) {
          this.reproducirSonido('contexto');
        }
        if (next && next !== prev) {
          this.indiceTip.set(0);
        }
      });
  }

  setOverride(id: string | null): void {
    this.overrideId.set(id);
    this.tipsPrepend.set([]);
    if (id && this.activo() && this.sonido()) {
      this.reproducirSonido('aparece');
    }
    this.indiceTip.set(0);
  }

  /** Antepone tips al contexto actual (p. ej. ayuda de un formulario modal abierto). */
  setTipsPrepend(tips: AsistenteTip[]): void {
    this.tipsPrepend.set(tips);
    this.indiceTip.set(0);
    if (tips.length && this.activo()) {
      this.expandido.set(true);
      if (this.sonido()) this.reproducirSonido('aparece');
    }
  }

  clearTipsPrepend(): void {
    this.tipsPrepend.set([]);
  }

  toggleActivo(): void {
    const v = !this.activo();
    this.activo.set(v);
    localStorage.setItem(LS_ACTIVO, v ? '1' : '0');
    if (!v) this.expandido.set(false);
  }

  toggleSonido(): void {
    const v = !this.sonido();
    this.sonido.set(v);
    localStorage.setItem(LS_SONIDO, v ? '1' : '0');
    if (v) this.reproducirSonido('toggle');
  }

  toggleExpandido(): void {
    const v = !this.expandido();
    this.expandido.set(v);
    if (v && this.sonido()) this.reproducirSonido('aparece');
  }

  cerrarPanel(): void {
    this.expandido.set(false);
  }

  siguienteTip(): void {
    const ctx = this.contexto();
    if (!ctx?.tips.length) return;
    this.indiceTip.update((i) => (i + 1) % ctx.tips.length);
    if (this.sonido()) this.reproducirSonido('tip');
  }

  anteriorTip(): void {
    const ctx = this.contexto();
    if (!ctx?.tips.length) return;
    this.indiceTip.update((i) => (i - 1 + ctx.tips.length) % ctx.tips.length);
    if (this.sonido()) this.reproducirSonido('tip');
  }

  /** Sonido suave generado con Web Audio (sin archivos externos). */
  reproducirSonido(tipo: 'aparece' | 'contexto' | 'tip' | 'toggle'): void {
    if (!this.sonido()) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (tipo === 'contexto') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (tipo === 'aparece') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(392, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
      osc.onended = () => void ctx.close();
    } catch {
      /* sin audio en este navegador */
    }
  }

  private resolverDesdeUrl(url: string): void {
    const id = this.idContextoDesdeUrl(url);
    this.contextoId.set(id);
    if (!id) this.expandido.set(false);
  }

  /** Mapeo URL → id de catálogo. Orden: rutas más específicas primero. */
  private idContextoDesdeUrl(url: string): string | null {
    const [pathPart, queryPart = ''] = url.split('?');
    const path = pathPart.split('#')[0];
    const tab = new URLSearchParams(queryPart).get('tab');

    if (!path.startsWith('/app')) return null;

    // —— Configuración ——
    if (path.includes('/configuracion/facturacion')) return 'facturacion.config';
    if (path.includes('/configuracion/clientes')) return 'facturacion.clientes';
    if (path.includes('/configuracion/usuarios')) return 'config.usuarios';
    if (path.includes('/configuracion/sedes')) return 'config.sedes';
    if (path.includes('/configuracion/roles')) return 'config.roles';
    if (path.includes('/configuracion/recibos')) return 'config.recibos';
    if (path.includes('/configuracion/certificados')) return 'config.certificados';
    if (path.includes('/configuracion/catalogos')) return 'config.catalogos';
    if (path.includes('/configuracion/georef')) return 'config.georef';
    if (path.includes('/configuracion/nomina')) return 'config.nomina';
    if (path.includes('/configuracion/monitor')) return 'config.auditoria';
    if (path.includes('/configuracion/auditoria')) return 'config.auditoria';
    if (path.includes('/configuracion/backup')) return 'sistema.backup';
    if (path.includes('/configuracion/restore')) return 'sistema.restore';
    if (path.includes('/configuracion/reset')) return 'sistema.reset';
    if (path.includes('/configuracion/migracion') || path.includes('/sistema/migracion')) {
      return 'sistema.migracion';
    }
    if (path.includes('/configuracion/empresa')) return 'config.empresa';
    if (path.includes('/configuracion/alertas')) return 'config.alertas';
    if (path.includes('/configuracion/contratos-cap-fiscal')) return 'config.contratos-cap';
    if (path.includes('/configuracion/formato-inspeccion-vehiculos')) return 'config.formato-inspeccion';
    if (path.includes('/configuracion/requisitos-documentos')) return 'config.requisitos';

    // —— Facturación ——
    if (path.includes('/facturacion')) return 'facturacion.hub';

    // —— Caja ——
    if (path.includes('/cobros-pendientes')) return 'caja.cobros-pendientes';
    if (path.includes('/cierre-general')) return 'caja.cierre-general';
    if (path.includes('/cierres/')) return 'caja.cierres';
    if (path.includes('/cierres')) return 'caja.cierres';
    if (path.includes('/caja/ingresos-todos')) return 'caja.ingresos-todos';
    if (path.includes('/caja/egresos-todos')) return 'caja.egresos-todos';
    if (path.includes('/caja/descuadres')) return 'caja.descuadres';
    if (path.includes('/caja/ingresos/nuevo')) return 'caja.ingreso-form';
    if (path.includes('/caja/ingresos')) return 'caja.ingresos';
    if (path.includes('/caja/egresos/nuevo') || path.includes('/caja/egresos/editar')) return 'caja.egreso-form';
    if (path.includes('/caja/egresos')) return 'caja.egresos';
    if (path.includes('/caja')) return 'caja.cuadre';

    // —— RRHH ——
    if (path.includes('/rrhh/novedades')) return 'rrhh.novedades';
    if (path.includes('/rrhh/catalogos')) return 'rrhh.hub';
    if (path.includes('/rrhh/empleados')) return 'rrhh.empleados';
    if (path.includes('/rrhh/contratos')) return 'rrhh.contratos';
    if (path.includes('/rrhh/nomina')) return 'rrhh.nomina';
    if (path.includes('/rrhh')) return 'rrhh.hub';

    // —— Programación CEA ——
    if (path.includes('/programacion-cea/clases-grupales')) return 'programacion-cea.clases-grupales';
    if (path.includes('/programacion-cea/clases-practica')) return 'programacion-cea.clases-practica';
    if (path.includes('/programacion-cea/clases-hoy')) return 'programacion-cea.clases-hoy';
    if (path.includes('/programacion-cea')) return 'programacion-cea.hub';

    // —— Jornadas ——
    if (path.includes('/jornadas/instructor')) return 'jornadas.instructor';
    if (path.includes('/jornadas/en-proceso')) return 'jornadas.en-proceso';
    if (path.includes('/jornadas/clases-hoy')) return 'jornadas.clases-hoy';
    if (path.includes('/jornadas/certificados')) return 'jornadas.certificados';
    if (path.match(/\/contratos\/?$/)) return 'jornadas.contratos';
    if (path.includes('/jornadas/alumnos')) return 'alumnos.lista.jornadas';
    if (path.includes('/jornadas')) return 'jornadas.hub';

    // —— Instructores ——
    if (path.match(/\/instructores\/[^/]+/)) return 'instructores.detalle';
    if (path.includes('/instructores')) return 'instructores.hub';

    // —— Vehículos ——
    if (path.includes('/vehiculos/nuevo') || path.match(/\/vehiculos\/[^/]+/)) {
      return 'vehiculos.detalle';
    }
    if (path.includes('/vehiculos')) return 'vehiculos.lista';

    // —— Alumnos (pestañas) ——
    if (path.includes('/alumnos/nuevo')) return 'alumnos.nuevo';
    const detalleAlumno = path.match(/\/alumnos\/([^/?]+)/);
    if (detalleAlumno && detalleAlumno[1] !== 'nuevo') {
      if (tab === 'servicios') return 'alumnos.detalle.servicios';
      if (tab === 'pagos') return 'alumnos.detalle.pagos';
      if (tab === 'certificados') return 'alumnos.detalle.certificados';
      if (tab === 'documentos') return 'alumnos.detalle.documentos';
      if (tab === 'programacion') return 'alumnos.detalle.programacion';
      return 'alumnos.detalle.datos';
    }
    if (path.match(/\/alumnos\/?$/)) return 'alumnos.lista';

    // —— Cohortes académicas ——
    if (path.match(/\/cohortes\/[^/]+/)) return 'cohortes.detalle';
    if (path.includes('/cohortes')) return 'cohortes.hub';

    // —— Aula virtual ——
    if (path.includes('/aula-virtual/sitio')) return 'aula-virtual.sitio';
    if (path.includes('/aula-virtual')) return 'aula-virtual.admin';

    // —— Informes ——
    if (path.match(/\/informes\/[^/]+/)) return 'informes.detalle';
    if (path.includes('/informes')) return 'informes.hub';

    // —— Otros módulos ——
    if (path.includes('/certificados')) return 'certificados.lista';
    if (path.includes('/programas')) return 'programas.admin';
    if (path.includes('/servicios')) return 'servicios.admin';
    if (path.includes('/dashboard')) return 'dashboard.main';
    if (path.includes('/sin-acceso')) return 'general.sin-acceso';
    if (path === '/app' || path === '/app/') return 'inicio.home';

    // Fallback: pantalla dentro de /app sin catálogo específico
    if (path.startsWith('/app/') && Object.keys(ASISTENTE_CATALOGO).length) {
      return 'inicio.home';
    }

    return null;
  }

  private readBool(key: string, def: boolean): boolean {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return def;
      return v === '1' || v === 'true';
    } catch {
      return def;
    }
  }
}
