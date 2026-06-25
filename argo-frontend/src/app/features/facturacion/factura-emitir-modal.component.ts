import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Cliente, ClienteService } from '../../core/services/cliente.service';
import {
  FacturacionService,
  FacturaElectronicaItem,
  LiquidacionElegibleFe,
  PreviewFactura,
} from '../../core/services/facturacion.service';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';
import { ComprobanteHoyAlertService } from '../../core/services/comprobante-hoy-alert.service';

@Component({
  selector: 'argo-factura-emitir-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './factura-emitir-modal.component.html',
  styleUrls: ['./factura-emitir-modal.component.scss'],
})
export class FacturaEmitirModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) numDoc!: number | string;
  @Input() alumnoNombre = '';
  @Input() alumnoId = '';
  @Output() cerrar = new EventEmitter<void>();
  @Output() emitida = new EventEmitter<void>();

  private feSvc = inject(FacturacionService);
  private cliSvc = inject(ClienteService);
  private asistente = inject(AsistenteContextoService);
  private comprobanteAlertSvc = inject(ComprobanteHoyAlertService);

  loading = signal(true);
  emitiendo = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  elegibles = signal<LiquidacionElegibleFe[]>([]);
  seleccion = signal<Set<string>>(new Set());

  tipoAdquirente = signal<'alumno' | 'cliente'>('alumno');
  clientes = signal<Cliente[]>([]);
  idCliente = signal<string>('');
  buscarCliente = signal('');

  preview = signal<PreviewFactura | null>(null);
  facturaEmitida = signal<FacturaElectronicaItem | null>(null);

  hayItems = computed(() => this.elegibles().length > 0);
  totalSeleccionados = computed(() => this.seleccion().size);

  ngOnInit(): void {
    this.asistente.setOverride('facturacion.emitir-modal');
    this.feSvc.elegiblesAlumno(this.numDoc).subscribe({
      next: (rows) => {
        this.elegibles.set(rows || []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudieron cargar los ítems facturables');
      },
    });
    this.cliSvc.listar().subscribe({
      next: (rows) => this.clientes.set(rows || []),
      error: () => this.clientes.set([]),
    });
  }

  ngOnDestroy(): void {
    this.asistente.setOverride(null);
  }

  estaSel(id: string): boolean {
    return this.seleccion().has(id);
  }

  toggle(id: string): void {
    const s = new Set(this.seleccion());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.seleccion.set(s);
    this.preview.set(null);
  }

  clientesFiltrados = computed(() => {
    const q = this.buscarCliente().trim().toLowerCase();
    if (!q) return this.clientes();
    return this.clientes().filter(
      (c) =>
        (c.razonSocial || '').toLowerCase().includes(q) ||
        (c.nombres || '').toLowerCase().includes(q) ||
        (c.identificacion || '').includes(q),
    );
  });

  cambiarAdquirente(tipo: 'alumno' | 'cliente'): void {
    this.tipoAdquirente.set(tipo);
    this.preview.set(null);
  }

  fmt(n?: number | null): string {
    return Number(n || 0).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    });
  }

  labelCondicion(c?: string): string {
    if (c === 'excluido') return 'Excluido IVA';
    if (c === 'exento') return 'Exento (0%)';
    return 'Gravado';
  }

  private mensajeErrorHttp(e: { error?: { message?: string; details?: unknown } }): string {
    const base = e?.error?.message || 'Error al emitir la factura';
    const errs = this.erroresFactusDesdeRespuesta(e?.error?.details);
    if (!errs) return base;
    const partes: string[] = [];
    for (const [campo, val] of Object.entries(errs)) {
      const texto = Array.isArray(val) ? val.join('; ') : String(val);
      if (texto) partes.push(campo === 'cliente' ? texto : `${campo}: ${texto}`);
    }
    return partes.length ? `${base} — ${partes.join(' · ')}` : base;
  }

  private erroresFactusDesdeRespuesta(
    details: unknown,
  ): Record<string, string[] | string> | null {
    if (!details || typeof details !== 'object') return null;
    const det = details as Record<string, unknown>;
    if (det['errors'] && typeof det['errors'] === 'object') {
      return det['errors'] as Record<string, string[] | string>;
    }
    const data = det['data'] as Record<string, unknown> | undefined;
    if (data?.['errors'] && typeof data['errors'] === 'object') {
      return data['errors'] as Record<string, string[] | string>;
    }
    const keys = Object.keys(det);
    if (keys.some((k) => k.includes('.') || k === 'cliente')) {
      return det as Record<string, string[] | string>;
    }
    return null;
  }

  private payload() {
    return {
      numDoc: Number(this.numDoc),
      idLiquidaciones: [...this.seleccion()],
      tipoAdquirente: this.tipoAdquirente(),
      idCliente: this.tipoAdquirente() === 'cliente' ? this.idCliente() || null : null,
    };
  }

  private validar(): string | null {
    if (!this.seleccion().size) return 'Seleccione al menos un ítem a facturar';
    if (this.tipoAdquirente() === 'cliente' && !this.idCliente()) return 'Seleccione el cliente (tercero)';
    return null;
  }

  verPreview(): void {
    const err = this.validar();
    if (err) {
      this.msgError.set(true);
      this.msg.set(err);
      return;
    }
    this.msg.set(null);
    this.feSvc.preview(this.payload()).subscribe({
      next: (p) => this.preview.set(p),
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo calcular el resumen');
      },
    });
  }

  verDocumentoEmitido(): void {
    const doc = this.facturaEmitida();
    if (doc) this.feSvc.verFactura(doc, (m) => this.msg.set(m));
  }

  emitir(): void {
    const err = this.validar();
    if (err) {
      this.msgError.set(true);
      this.msg.set(err);
      return;
    }
    this.emitiendo.set(true);
    this.msg.set(null);
    this.feSvc.emitir(this.payload()).subscribe({
      next: (doc) => {
        this.emitiendo.set(false);
        this.facturaEmitida.set(doc);
        this.comprobanteAlertSvc.notificarDesdeFactura(doc as unknown as Record<string, unknown>, {
          numDoc: this.numDoc,
          nombreCompleto: this.alumnoNombre || doc.adquirente?.nombre || '',
          alumnoId: this.alumnoId || undefined,
        });
        this.emitida.emit();
        this.msgError.set(false);
        this.msg.set(
          doc.modoDesarrollo
            ? `Modo desarrollo: factura ${doc.numeroFactura} registrada (sin envío DIAN).`
            : `Factura ${doc.numeroFactura || ''} emitida.`,
        );
      },
      error: (e) => {
        this.emitiendo.set(false);
        this.msgError.set(true);
        this.msg.set(this.mensajeErrorHttp(e));
      },
    });
  }
}
