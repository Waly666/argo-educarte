import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  FacturaElectronicaItem,
  FacturacionService,
  NotaCreditoElectronica,
  NotaCreditoPayload,
  PreviewNotaCredito,
} from '../../core/services/facturacion.service';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';

@Component({
  selector: 'argo-nota-credito-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nota-credito-modal.component.html',
  styleUrls: ['./factura-emitir-modal.component.scss'],
})
export class NotaCreditoModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) factura!: FacturaElectronicaItem;
  @Output() cerrar = new EventEmitter<void>();
  @Output() emitida = new EventEmitter<void>();

  private feSvc = inject(FacturacionService);
  private asistente = inject(AsistenteContextoService);

  emitiendo = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  tipo = signal<'total' | 'parcial'>('total');
  concepto = signal<string>('2');
  motivo = signal('');
  seleccion = signal<Set<string>>(new Set());
  conceptos = signal<{ id: string; label: string }[]>([]);
  preview = signal<PreviewNotaCredito | null>(null);
  notaEmitida = signal<NotaCreditoElectronica | null>(null);

  items = computed(() => this.factura?.items || []);

  ngOnInit(): void {
    this.asistente.setOverride('facturacion.nota-modal');
    this.feSvc.catalogos().subscribe({
      next: (c) => this.conceptos.set(c.conceptosNotaCredito || []),
      error: () => this.conceptos.set([]),
    });
  }

  ngOnDestroy(): void {
    this.asistente.setOverride(null);
  }

  cambiarTipo(t: 'total' | 'parcial'): void {
    this.tipo.set(t);
    this.concepto.set(t === 'total' ? '2' : '1');
    this.preview.set(null);
  }

  estaSel(id?: string): boolean {
    return !!id && this.seleccion().has(id);
  }

  toggle(id?: string): void {
    if (!id) return;
    const s = new Set(this.seleccion());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.seleccion.set(s);
    this.preview.set(null);
  }

  fmt(n?: number | null): string {
    return Number(n || 0).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    });
  }

  private payload(): NotaCreditoPayload {
    return {
      tipo: this.tipo(),
      conceptoCorreccion: this.concepto(),
      idLiquidaciones: this.tipo() === 'parcial' ? [...this.seleccion()] : [],
      motivo: this.motivo().trim(),
    };
  }

  private validar(): string | null {
    if (this.tipo() === 'parcial' && !this.seleccion().size) {
      return 'Seleccione al menos un ítem a devolver';
    }
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
    this.feSvc.notaCreditoPreview(this.factura._id, this.payload()).subscribe({
      next: (p) => this.preview.set(p),
      error: (e) => {
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo calcular el resumen');
      },
    });
  }

  verDocumentoEmitido(): void {
    const doc = this.notaEmitida();
    if (doc) this.feSvc.verNotaCredito(doc, (m) => this.msg.set(m));
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
    this.feSvc.notaCreditoEmitir(this.factura._id, this.payload()).subscribe({
      next: (doc) => {
        this.emitiendo.set(false);
        this.notaEmitida.set(doc);
        this.emitida.emit();
        this.msgError.set(false);
        this.msg.set(
          doc.modoDesarrollo
            ? `Modo desarrollo: nota crédito ${doc.numeroNota} registrada (sin envío DIAN).`
            : `Nota crédito ${doc.numeroNota || ''} emitida.`,
        );
      },
      error: (e) => {
        this.emitiendo.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al emitir la nota crédito');
      },
    });
  }
}
