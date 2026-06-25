import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ClienteService } from '../../core/services/cliente.service';
import {
  ConfigContratosCapService,
  ReglaFiscalContratoCap,
} from '../../core/services/config-contratos-cap.service';

@Component({
  selector: 'argo-config-contratos-cap',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-contratos-cap.component.html',
  styleUrls: ['./config-contratos-cap.component.scss'],
})
export class ConfigContratosCapComponent implements OnInit {
  private svc = inject(ConfigContratosCapService);
  private clienteSvc = inject(ClienteService);

  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  reglas = signal<ReglaFiscalContratoCap[]>([]);
  condicionesIva = signal<{ id: string; label: string }[]>([]);
  responsabilidadesFiscales = signal<{ code: string; label: string }[]>([]);

  ngOnInit(): void {
    this.svc.catalogos().subscribe({
      next: (c) => this.condicionesIva.set(c.condicionesIva || []),
      error: () => this.condicionesIva.set([]),
    });
    this.clienteSvc.catalogos().subscribe({
      next: (c) => this.responsabilidadesFiscales.set(c.responsabilidadesFiscales || []),
      error: () => this.responsabilidadesFiscales.set([]),
    });
    this.recargar();
  }

  tipoAccent(tipo: string): string {
    const map: Record<string, string> = {
      juridica_empresa: 'empresa',
      juridica_oficial: 'oficial',
      juridica_ong: 'ong',
      persona_natural: 'natural',
    };
    return map[tipo] || 'empresa';
  }

  tipoIcono(tipo: string): string {
    const map: Record<string, string> = {
      juridica_empresa: '🏢',
      juridica_oficial: '🏛',
      juridica_ong: '🤝',
      persona_natural: '👤',
    };
    return map[tipo] || '📋';
  }

  tipoTitulo(r: ReglaFiscalContratoCap): string {
    const partes = String(r.label || '').split(' — ');
    return partes.length > 1 ? partes[partes.length - 1] : r.label || r.tipo;
  }

  tipoSubtitulo(r: ReglaFiscalContratoCap): string {
    const partes = String(r.label || '').split(' — ');
    return partes.length > 1 ? partes.slice(0, -1).join(' — ') : '';
  }

  labelCondicionIva(id: string): string {
    return this.condicionesIva().find((c) => c.id === id)?.label || id || '—';
  }

  recargar(): void {
    this.loading.set(true);
    this.svc.obtener().subscribe({
      next: (r) => {
        this.reglas.set(r.reglas || []);
        this.loading.set(false);
      },
      error: () => {
        this.reglas.set([]);
        this.loading.set(false);
        this.msgError.set(true);
        this.msg.set('No se pudo cargar la configuración');
      },
    });
  }

  patchRegla(tipo: string, campo: keyof ReglaFiscalContratoCap, valor: unknown): void {
    this.reglas.update((rows) =>
      rows.map((r) => (r.tipo === tipo ? { ...r, [campo]: valor } : r)),
    );
  }

  guardar(): void {
    this.saving.set(true);
    this.msg.set(null);
    this.svc.guardar(this.reglas()).subscribe({
      next: (r) => {
        this.reglas.set(r.reglas || []);
        this.saving.set(false);
        this.msgError.set(false);
        this.msg.set('Configuración guardada');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo guardar');
      },
    });
  }
}
