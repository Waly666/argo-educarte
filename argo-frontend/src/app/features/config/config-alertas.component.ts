import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AlertasRuntimeService } from '../../core/services/alertas-runtime.service';
import {
  AlertasCatalogos,
  ConfigAlertasService,
  ReglaAlerta,
  VentanaInicioAlerta,
} from '../../core/services/config-alertas.service';

interface GrupoUi {
  id: string;
  label: string;
  reglas: ReglaAlerta[];
  accent: string;
}

@Component({
  selector: 'argo-config-alertas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './config-alertas.component.html',
  styleUrls: ['./config-alertas.component.scss'],
})
export class ConfigAlertasComponent implements OnInit {
  private svc = inject(ConfigAlertasService);
  private runtime = inject(AlertasRuntimeService);

  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);
  reglas = signal<ReglaAlerta[]>([]);
  catalogos = signal<AlertasCatalogos | null>(null);
  grupoAbierto = signal<string | null>('alumnos');

  grupos = computed<GrupoUi[]>(() => {
    const mapa = new Map(this.reglas().map((r) => [r.key, r]));
    const cats = this.catalogos()?.grupos || [];
    const accents: Record<string, string> = {
      caja: 'caja',
      jornadas: 'jornadas',
      instructores: 'instructores',
      programacion_cea: 'cea',
      vehiculos: 'vehiculos',
      empleados: 'empleados',
      certificados: 'certificados',
      alumnos: 'alumnos',
    };
    return cats.map((g) => ({
      id: g.id,
      label: g.label,
      accent: accents[g.id] || 'default',
      reglas: g.alarmas.map((a) => mapa.get(a.key)!).filter(Boolean),
    }));
  });

  activasCount = computed(() => this.reglas().filter((r) => r.activo).length);

  ngOnInit(): void {
    this.svc.catalogos().subscribe({
      next: (c) => this.catalogos.set(c),
      error: () => this.catalogos.set(null),
    });
    this.recargar();
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
        this.msg.set('No se pudo cargar la configuración de alertas');
      },
    });
  }

  toggleGrupo(id: string): void {
    this.grupoAbierto.set(this.grupoAbierto() === id ? null : id);
  }

  patchRegla(key: string, campo: keyof ReglaAlerta, valor: unknown): void {
    this.reglas.update((rows) => rows.map((r) => (r.key === key ? { ...r, [campo]: valor } : r)));
  }

  esComprobante(r: ReglaAlerta): boolean {
    return (
      r.key === 'alarmas.alumnos.comprobante_ingreso' ||
      r.key === 'alarmas.alumnos.comprobante_egreso' ||
      r.key === 'alarmas.alumnos.factura'
    );
  }

  tieneAntelacion(r: ReglaAlerta): boolean {
    return r.key.includes('clase_proxima') || r.key.includes('instructores.clase_proxima');
  }

  tieneDiasAntelacion(r: ReglaAlerta): boolean {
    return r.key === 'alarmas.certificados.vencimiento';
  }

  tieneDiasGracia(r: ReglaAlerta): boolean {
    return r.key === 'alarmas.certificados.vencidos';
  }

  activasEnGrupo(reglas: ReglaAlerta[]): number {
    return reglas.filter((r) => r.activo).length;
  }

  muestraPoll(r: ReglaAlerta): boolean {
    return !['alarmas.alumnos.saldos', 'alarmas.alumnos.documentos', 'alarmas.caja.sin_abrir'].includes(
      r.key,
    );
  }

  tituloCorto(label: string): string {
    const i = label.indexOf('(');
    return i > 0 ? label.slice(0, i).trim() : label;
  }

  guardar(): void {
    this.saving.set(true);
    this.msg.set(null);
    this.svc.guardar(this.reglas()).subscribe({
      next: (r) => {
        const reglas = r.reglas || [];
        this.reglas.set(reglas);
        this.runtime.aplicar(reglas);
        this.saving.set(false);
        this.msgError.set(false);
        this.msg.set('Configuración de alertas guardada');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo guardar');
      },
    });
  }

  ventanas(): { id: VentanaInicioAlerta; label: string }[] {
    return this.catalogos()?.ventanasInicio || [
      { id: 'desde_registro', label: 'Desde que se genera el registro' },
      { id: 'desde_inicio_dia', label: 'Desde inicio del día' },
    ];
  }
}
