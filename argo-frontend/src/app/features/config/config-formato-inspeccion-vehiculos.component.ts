import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ConfigFormatoInspeccionVehiculos,
  ConfigFormatoInspeccionVehiculosService,
} from '../../core/services/config-formato-inspeccion-vehiculos.service';

@Component({
  selector: 'argo-config-formato-inspeccion-vehiculos',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './config-formato-inspeccion-vehiculos.component.html',
  styleUrls: ['./config-formato-inspeccion-vehiculos.component.scss'],
})
export class ConfigFormatoInspeccionVehiculosComponent implements OnInit {
  private cfgSvc = inject(ConfigFormatoInspeccionVehiculosService);

  prefijoConsecutivo = signal('INSP');
  consecutivoInspeccion = signal(0);
  proximoConsecutivoPreview = computed(() => {
    const pref = String(this.prefijoConsecutivo() || 'INSP').trim() || 'INSP';
    const n = Math.max(0, this.consecutivoInspeccion()) + 1;
    return `${pref}-${String(n).padStart(6, '0')}`;
  });

  saving = signal(false);
  loading = signal(true);
  msg = signal<string | null>(null);
  msgError = signal(false);

  ngOnInit(): void {
    this.cfgSvc.obtener().subscribe({
      next: (cfg) => {
        this.prefijoConsecutivo.set(cfg.prefijoConsecutivoInspeccion || 'INSP');
        this.consecutivoInspeccion.set(cfg.consecutivoInspeccion ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.msg.set('No se pudo cargar la configuración.');
        this.msgError.set(true);
      },
    });
  }

  guardar(): void {
    this.saving.set(true);
    this.msg.set(null);
    this.msgError.set(false);
    const payload: Pick<ConfigFormatoInspeccionVehiculos, 'prefijoConsecutivoInspeccion' | 'consecutivoInspeccion'> = {
      prefijoConsecutivoInspeccion: this.prefijoConsecutivo(),
      consecutivoInspeccion: this.consecutivoInspeccion(),
    };
    this.cfgSvc.guardar(payload).subscribe({
      next: (saved) => {
        this.prefijoConsecutivo.set(saved.prefijoConsecutivoInspeccion || 'INSP');
        this.consecutivoInspeccion.set(saved.consecutivoInspeccion ?? 0);
        this.saving.set(false);
        this.msgError.set(false);
        this.msg.set('Configuración guardada.');
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'Error al guardar.');
      },
    });
  }
}
