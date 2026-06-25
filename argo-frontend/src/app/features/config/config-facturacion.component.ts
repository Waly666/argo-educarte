import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FACTUS_SANDBOX_PLANTILLA } from '../../core/constants/factus-sandbox.plantilla';
import {
  ConfigFacturacion,
  ConfigService,
  FactusPruebaEmisionResultado,
  FactusRangoNumeracion,
} from '../../core/services/config.service';

@Component({
  selector: 'argo-config-facturacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-facturacion.component.html',
  styleUrls: ['./config-facturacion.component.scss'],
})
export class ConfigFacturacionComponent implements OnInit {
  private cfgSvc = inject(ConfigService);

  loading = signal(true);
  saving = signal(false);
  probando = signal(false);
  cargandoRangos = signal(false);
  probandoEmision = signal(false);
  limpiandoPendientes = signal(false);
  msg = signal<string | null>(null);
  pruebaMsg = signal<string | null>(null);
  pruebaOk = signal(true);
  rangos = signal<FactusRangoNumeracion[]>([]);
  rangosMsg = signal<string | null>(null);
  emisionPrueba = signal<FactusPruebaEmisionResultado | null>(null);

  catalogos = signal<{ proveedores: { id: string; label: string }[]; ambientes: { id: string; label: string }[]; modosEmision: { id: string; label: string }[] }>({
    proveedores: [],
    ambientes: [],
    modosEmision: [],
  });

  form = signal<
    ConfigFacturacion & { clientSecret?: string; password?: string }
  >({
    proveedor: 'stub',
    ambiente: 'sandbox',
    modoEmision: 'manual',
    valorIncluyeIva: true,
    sendEmail: true,
    activo: false,
  });

  esFactus = computed(() => this.form().proveedor === 'factus');
  esSandbox = computed(() => this.form().ambiente === 'sandbox');
  rangoSeleccionado = computed(() => {
    const id = this.form().numberingRangeId;
    if (id == null) return null;
    return this.rangos().find((r) => r.id === id) || null;
  });

  ngOnInit(): void {
    this.cfgSvc.catalogosFacturacion().subscribe({
      next: (c) => this.catalogos.set(c),
      error: () => {
        this.catalogos.set({
          proveedores: [
            { id: 'stub', label: 'Desarrollo (local)' },
            { id: 'factus', label: 'Factus API' },
          ],
          ambientes: [
            { id: 'sandbox', label: 'Sandbox (pruebas)' },
            { id: 'produccion', label: 'Producción' },
          ],
          modosEmision: [{ id: 'manual', label: 'Manual' }],
        });
      },
    });
    this.cfgSvc.obtenerFacturacion().subscribe({
      next: (c) => {
        this.form.set({ ...c, clientSecret: '', password: '' });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.msg.set('No se pudo cargar la configuración');
      },
    });
  }

  patch<K extends keyof (ConfigFacturacion & { clientSecret?: string; password?: string })>(
    k: K,
    v: (ConfigFacturacion & { clientSecret?: string; password?: string })[K],
  ): void {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  aplicarPlantillaSandbox(): void {
    const p = FACTUS_SANDBOX_PLANTILLA;
    this.form.update((f) => ({
      ...f,
      proveedor: p.proveedor,
      ambiente: p.ambiente,
      baseUrl: p.baseUrl,
      clientId: p.clientId,
      clientSecret: p.clientSecret,
      username: p.username,
      password: p.password,
      activo: p.activo,
      sendEmail: p.sendEmail,
      valorIncluyeIva: p.valorIncluyeIva,
      modoEmision: p.modoEmision,
      emisorNit: p.emisorNit,
      emisorDv: p.emisorDv,
      emisorRazonSocial: p.emisorRazonSocial,
      emisorResponsabilidadFiscal: p.emisorResponsabilidadFiscal,
      emisorRegimen: p.emisorRegimen,
      emisorMunicipioCodigo: p.emisorMunicipioCodigo,
      ivaPorDefecto: p.ivaPorDefecto,
      prefijoDesarrollo: p.prefijoDesarrollo,
      numberingRangeId: p.numberingRangeId ?? f.numberingRangeId,
    }));
    this.msg.set('Plantilla sandbox Factus V2 aplicada. Guarde y luego cargue los rangos de numeración.');
    this.pruebaMsg.set(null);
    this.emisionPrueba.set(null);
  }

  guardar(): void {
    this.saving.set(true);
    this.msg.set(null);
    const f = this.form();
    const payload: Partial<ConfigFacturacion> & { clientSecret?: string; password?: string } = {
      proveedor: f.proveedor,
      ambiente: f.ambiente,
      baseUrl: f.baseUrl,
      clientId: f.clientId,
      username: f.username,
      numberingRangeId: f.numberingRangeId,
      modoEmision: f.modoEmision,
      valorIncluyeIva: f.valorIncluyeIva,
      sendEmail: f.sendEmail,
      activo: f.activo,
      emisorNit: f.emisorNit,
      emisorDv: f.emisorDv,
      emisorRazonSocial: f.emisorRazonSocial,
      emisorResponsabilidadFiscal: f.emisorResponsabilidadFiscal,
      emisorRegimen: f.emisorRegimen,
      emisorActividadEconomica: f.emisorActividadEconomica,
      emisorMunicipioCodigo: f.emisorMunicipioCodigo,
      ivaPorDefecto: f.ivaPorDefecto,
      prefijoDesarrollo: f.prefijoDesarrollo,
    };
    if (f.clientSecret?.trim()) payload.clientSecret = f.clientSecret.trim();
    if (f.password?.trim()) payload.password = f.password.trim();

    this.cfgSvc.guardarFacturacion(payload).subscribe({
      next: (c) => {
        this.form.set({ ...c, clientSecret: '', password: '' });
        this.saving.set(false);
        this.msg.set('Configuración guardada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msg.set(e?.error?.message || 'Error al guardar');
      },
    });
  }

  probar(): void {
    this.probando.set(true);
    this.pruebaMsg.set(null);
    this.cfgSvc.probarFacturacion().subscribe({
      next: (r) => {
        this.probando.set(false);
        this.pruebaOk.set(!!r.ok);
        this.pruebaMsg.set(r.message);
      },
      error: (e) => {
        this.probando.set(false);
        this.pruebaOk.set(false);
        this.pruebaMsg.set(e?.error?.message || 'Error de conexión');
      },
    });
  }

  cargarRangos(): void {
    this.cargandoRangos.set(true);
    this.rangosMsg.set(null);
    this.cfgSvc.listarRangosFacturacion().subscribe({
      next: (r) => {
        this.cargandoRangos.set(false);
        const lista = r.rangos || [];
        this.rangos.set(lista);
        if (!lista.length) {
          this.rangosMsg.set('No hay rangos de factura activos en Factus. Verifique la cuenta sandbox.');
          return;
        }
        const sugerido = r.sugeridoId ?? lista.find((x) => x.esFacturaVenta)?.id ?? lista[0]?.id ?? null;
        const sugeridoLbl = r.sugeridoLabel || lista.find((x) => x.id === sugerido)?.label;
        this.rangosMsg.set(
          sugeridoLbl
            ? `${lista.length} rango(s) de factura · sugerido: ${sugeridoLbl}`
            : `${lista.length} rango(s) de factura encontrado(s).`,
        );
        const actual = this.form().numberingRangeId;
        if ((actual == null || !lista.some((x) => x.id === actual)) && sugerido != null) {
          this.patch('numberingRangeId', sugerido);
        }
      },
      error: (e) => {
        this.cargandoRangos.set(false);
        this.rangos.set([]);
        this.rangosMsg.set(e?.error?.message || 'No se pudieron cargar los rangos. Guarde credenciales y pruebe conexión.');
      },
    });
  }

  seleccionarRango(id: number | null): void {
    this.patch('numberingRangeId', id);
  }

  probarEmision(): void {
    const rangeId = this.form().numberingRangeId;
    if (rangeId == null) {
      this.emisionPrueba.set({
        ok: false,
        message: 'Seleccione un rango de numeración en la tabla antes de emitir la prueba.',
      });
      return;
    }
    this.probandoEmision.set(true);
    this.emisionPrueba.set(null);
    this.cfgSvc.probarEmisionFacturacion(rangeId).subscribe({
      next: (r) => {
        this.probandoEmision.set(false);
        this.emisionPrueba.set(r);
      },
      error: (e) => {
        this.probandoEmision.set(false);
        const msg = e?.error?.message || 'Error al emitir factura de prueba';
        this.emisionPrueba.set({
          ok: false,
          message:
            e?.status === 409 || e?.error?.code === 'FACTUS_PENDIENTE_DIAN'
              ? `${msg} Use «Limpiar pendientes en Factus» y vuelva a intentar.`
              : msg,
          errors: e?.error?.details?.errors || e?.error?.errors || null,
        });
      },
    });
  }

  limpiarPendientesFactus(): void {
    this.limpiandoPendientes.set(true);
    this.rangosMsg.set(null);
    this.cfgSvc.limpiarPendientesFacturacion(true).subscribe({
      next: (r) => {
        this.limpiandoPendientes.set(false);
        this.rangosMsg.set(r.message);
        this.emisionPrueba.set(null);
      },
      error: (e) => {
        this.limpiandoPendientes.set(false);
        this.rangosMsg.set(e?.error?.message || 'No se pudieron limpiar las facturas pendientes');
      },
    });
  }

  abrirPdfPrueba(): void {
    const url = this.emisionPrueba()?.urlPdf;
    if (url) window.open(url, '_blank', 'noopener');
  }

  tieneErroresDian(errors: Record<string, string> | null | undefined): boolean {
    return !!errors && Object.keys(errors).length > 0;
  }
}
