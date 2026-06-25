import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CajaActivaResponse, CajaSesionService } from './caja-sesion.service';

@Injectable({ providedIn: 'root' })
export class CajaEstadoService {
  private cajaSvc = inject(CajaSesionService);

  readonly abierta = signal<boolean | null>(null);
  readonly loading = signal(false);
  readonly sesion = signal<CajaActivaResponse['sesion']>(null);
  private ocultaBannerCerrada = signal(false);
  readonly mostrarBannerCerrada = computed(() => !this.ocultaBannerCerrada());

  cerrarBannerCerrada(): void {
    this.ocultaBannerCerrada.set(true);
  }

  async refrescar(): Promise<boolean> {
    this.loading.set(true);
    try {
      const r = await firstValueFrom(this.cajaSvc.activa());
      const prev = this.abierta();
      const ok = !!r.abierta;
      this.abierta.set(ok);
      this.sesion.set(r.sesion ?? null);
      if (ok) this.ocultaBannerCerrada.set(false);
      else if (prev === true) this.ocultaBannerCerrada.set(false);
      return ok;
    } catch {
      this.abierta.set(false);
      this.sesion.set(null);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  marcarAbierta(): void {
    this.abierta.set(true);
    this.ocultaBannerCerrada.set(false);
  }

  marcarCerrada(): void {
    this.abierta.set(false);
    this.sesion.set(null);
    this.ocultaBannerCerrada.set(false);
  }
}
