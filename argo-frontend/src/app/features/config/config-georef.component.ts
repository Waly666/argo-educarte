import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ConfigGeoref,
  ConfigService,
  GeorefProveedorOpcion,
} from '../../core/services/config.service';

@Component({
  selector: 'argo-config-georef',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-georef.component.html',
  styleUrls: ['./config-georef.component.scss'],
})
export class ConfigGeorefComponent implements OnInit {
  private cfgSvc = inject(ConfigService);

  proveedores = signal<GeorefProveedorOpcion[]>([]);
  form = signal<ConfigGeoref & { hereApiKey?: string }>({ proveedor: 'nominatim' });
  saving = signal(false);
  loading = signal(true);
  probando = signal(false);
  msg = signal<string | null>(null);
  pruebaMsg = signal<string | null>(null);
  pruebaLat = signal('2.455897675701575');
  pruebaLng = signal('-76.58840314091881');

  ngOnInit(): void {
    this.cfgSvc.listarProveedoresGeoref().subscribe({
      next: (p) => this.proveedores.set(p || []),
      error: () => this.proveedores.set([
        { id: 'nominatim', label: 'OpenStreetMap (Nominatim) — gratuito' },
        { id: 'here', label: 'HERE — recomendado LatAm' },
      ]),
    });
    this.cfgSvc.obtenerGeoref().subscribe({
      next: (c) => {
        this.form.set({ ...c, hereApiKey: '' });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.msg.set('No se pudo cargar la configuración de geocodificación');
      },
    });
  }

  patch<K extends keyof (ConfigGeoref & { hereApiKey?: string })>(
    k: K,
    v: (ConfigGeoref & { hereApiKey?: string })[K],
  ) {
    this.form.update((f) => ({ ...f, [k]: v }));
  }

  guardar(): void {
    this.saving.set(true);
    this.msg.set(null);
    const f = this.form();
    const payload: Partial<ConfigGeoref> & { hereApiKey?: string } = {
      proveedor: f.proveedor,
      hereAppId: f.hereAppId,
    };
    if (f.hereApiKey?.trim()) payload.hereApiKey = f.hereApiKey.trim();

    this.cfgSvc.guardarGeoref(payload).subscribe({
      next: (c) => {
        this.form.set({ ...c, hereApiKey: '' });
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
    const lat = Number(this.pruebaLat());
    const lng = Number(this.pruebaLng());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.pruebaMsg.set('Coordenadas de prueba inválidas');
      return;
    }
    this.probando.set(true);
    this.pruebaMsg.set(null);
    this.cfgSvc.probarGeoref(lat, lng).subscribe({
      next: (r) => {
        this.probando.set(false);
        const x = r.resultado;
        const partes = [
          x.municipio && `Municipio: ${x.municipio}`,
          x.depto && `Depto: ${x.depto}`,
          x.codMunicipio && `Divipola: ${x.codMunicipio}`,
          x.proveedor && `Proveedor: ${x.proveedor}`,
          x.etiquetaMapa && `Etiqueta mapa: ${x.etiquetaMapa}`,
        ].filter(Boolean);
        this.pruebaMsg.set(partes.join(' · ') || 'Sin resultado');
      },
      error: (e) => {
        this.probando.set(false);
        this.pruebaMsg.set(e?.error?.message || 'Error en la prueba');
      },
    });
  }

  esHere(): boolean {
    return this.form().proveedor === 'here';
  }
}
