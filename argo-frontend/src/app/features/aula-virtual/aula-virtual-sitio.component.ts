import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { AulaVirtualAdminService, PortalAulaConfig } from '../../core/services/aula-virtual-admin.service';
import { AuthService } from '../../core/services/auth.service';
import { mergePortalLanding, PORTAL_LANDING_DEFAULTS } from '../../core/constants/portal-landing-defaults';
import { mergePortalSiteDefaults } from '../../core/constants/portal-site-defaults';
import { PORTAL_PLANTILLAS, PortalPlantilla } from '../../core/constants/portal-plantillas';
import {
  aplicarDisenoPortal,
  crearExportacionPortal,
  descargarJson,
  nombreArchivoDisenoPortal,
  parsearImportacionPortal,
} from '../../core/utils/portal-diseno.helpers';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { PortalPlantillaGaleriaComponent } from './portal-plantilla-galeria.component';
import { PortalSiteBuilderComponent, BuilderPanel } from './portal-site-builder.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'argo-aula-virtual-sitio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PortalSiteBuilderComponent, PortalPlantillaGaleriaComponent],
  templateUrl: './aula-virtual-sitio.component.html',
  styleUrl: './aula-virtual-sitio.component.scss',
})
export class AulaVirtualSitioComponent implements OnInit {
  private svc = inject(AulaVirtualAdminService);
  private auth = inject(AuthService);
  private confirm = inject(ConfirmDialogService);
  private route = inject(ActivatedRoute);

  /** Panel inicial del editor (ej. ?panel=appmovil para subir APK). */
  builderInitialPanel = signal<BuilderPanel | null>(null);

  /** Exportar / importar / galería: solo usuario soporte maestro (break-glass). */
  readonly puedeDisenoPortal = computed(() => this.auth.isSoporteMaestro());

  readonly plantillas = PORTAL_PLANTILLAS;
  galeriaAbierta = signal(false);

  readonly portalUrl = environment.production
    ? 'https://finstruvial.edu.co/'
    : 'http://localhost:4202/';

  portalForm: PortalAulaConfig = {
    nombreEmpresa: '',
    nit: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    email: '',
    emailContacto: '',
    heroTitulo: '',
    heroSubtitulo: '',
    acercaDeHtml: '',
    landing: mergePortalLanding(PORTAL_LANDING_DEFAULTS),
    site: mergePortalSiteDefaults(),
  };

  saving = signal(false);
  msg = signal<string | null>(null);
  err = signal(false);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const panel = q.get('panel');
      if (panel === 'appmovil') {
        this.builderInitialPanel.set('appmovil');
      }
    });

    this.svc.obtenerPortal().subscribe({
      next: (p) => {
        Object.assign(this.portalForm, p);
        this.portalForm.landing = mergePortalLanding(p.landing);
        this.portalForm.site = mergePortalSiteDefaults(p.site);
      },
      error: () => this.toast('No se pudo cargar la configuración del sitio', true),
    });
  }

  guardar() {
    this.saving.set(true);
    this.svc.guardarPortal(this.portalForm).subscribe({
      next: (res) => {
        Object.assign(this.portalForm, res.config);
        this.portalForm.landing = mergePortalLanding(res.config.landing);
        this.portalForm.site = mergePortalSiteDefaults(res.config.site);
        this.saving.set(false);
        this.toast(res.message || 'Sitio publicado');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast(e?.error?.message || 'Error al guardar', true);
      },
    });
  }

  exportarDiseno(): void {
    descargarJson(crearExportacionPortal(this.portalForm), nombreArchivoDisenoPortal());
    this.toast('Diseño exportado. Guarde el archivo JSON.');
  }

  async importarDiseno(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const ok = await this.confirm.open({
      title: 'Importar diseño',
      message:
        'Se reemplazarán colores, textos y secciones del editor. Logo y datos fiscales no cambian. Debe pulsar Publicar cambios después.',
      variant: 'warn',
      confirmLabel: 'Importar',
    });
    if (!ok) return;

    try {
      const diseno = parsearImportacionPortal(JSON.parse(await file.text()));
    aplicarDisenoPortal(this.portalForm, diseno);
      this.refrescarFormularioTrasDiseno();
      this.toast('Diseño importado. Revise la vista previa y pulse Publicar cambios.');
    } catch (e) {
      this.toast(e instanceof Error ? e.message : 'No se pudo leer el archivo.', true);
    }
  }

  async aplicarPlantillaDesdeGaleria(tpl: PortalPlantilla): Promise<void> {
    const ok = await this.confirm.open({
      title: 'Aplicar plantilla',
      message: `¿Usar «${tpl.nombre}»? Se reemplazarán colores, textos y secciones del editor.`,
      variant: 'warn',
      confirmLabel: 'Aplicar',
    });
    if (!ok) return;

    aplicarDisenoPortal(this.portalForm, tpl.diseno);
    this.refrescarFormularioTrasDiseno();
    this.galeriaAbierta.set(false);
    this.toast(`Plantilla «${tpl.nombre}» aplicada. Revise la vista previa y pulse Publicar cambios.`);
  }

  private refrescarFormularioTrasDiseno(): void {
    this.portalForm = {
      ...this.portalForm,
      landing: mergePortalLanding(this.portalForm.landing),
      site: mergePortalSiteDefaults(this.portalForm.site),
    };
  }

  private toast(text: string, isError = false) {
    this.msg.set(text);
    this.err.set(isError);
    setTimeout(() => this.msg.set(null), 4000);
  }

  onBuilderNotice(event: { message: string; error?: boolean }) {
    this.toast(event.message, !!event.error);
  }
}
