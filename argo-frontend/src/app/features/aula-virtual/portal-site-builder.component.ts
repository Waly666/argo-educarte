import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  mergePortalSiteDefaults,
  PORTAL_FUENTES,
  PORTAL_HOME_SECCIONES_LABELS,
  PORTAL_PAGINA_META,
  PortalSiteConfig,
} from '../../core/constants/portal-site-defaults';
import { AulaVirtualAdminService, PortalAulaConfig } from '../../core/services/aula-virtual-admin.service';
import { mergePortalLanding } from '../../core/constants/portal-landing-defaults';
import { PortalLandingEditorComponent } from './portal-landing-editor.component';
import { PortalFundacionEditorComponent } from './portal-fundacion-editor.component';
import { PortalSitePreviewComponent } from './portal-site-preview.component';
import { buildPortalThemeCssVars } from '../../core/utils/portal-theme-css.util';
import { environment } from '../../../environments/environment';

export type BuilderPanel =
  | 'panel'
  | 'paginas'
  | 'apariencia'
  | 'inicio'
  | 'contenido'
  | 'institucional'
  | 'blog'
  | 'empresa'
  | 'marca';

interface MenuItem {
  id: BuilderPanel;
  icon: string;
  label: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

interface PanelInfo {
  title: string;
  help: string;
}

interface GuiaPaso {
  num: number;
  titulo: string;
  texto: string;
  panel: BuilderPanel;
  listo: () => boolean;
}

@Component({
  selector: 'argo-portal-site-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PortalLandingEditorComponent,
    PortalFundacionEditorComponent,
    PortalSitePreviewComponent,
  ],
  templateUrl: './portal-site-builder.component.html',
  styleUrl: './portal-site-builder.component.scss',
})
export class PortalSiteBuilderComponent {
  private svc = inject(AulaVirtualAdminService);

  @Input({ required: true }) portalForm!: PortalAulaConfig;
  @Input({ required: true }) portalUrl!: string;
  @Output() avNotice = new EventEmitter<{ message: string; error?: boolean }>();

  heroUploading = signal(false);

  readonly paginaMeta = PORTAL_PAGINA_META;
  readonly fuentes = PORTAL_FUENTES;

  readonly menuGroups: MenuGroup[] = [
    {
      title: 'Empieza aquí',
      items: [
        { id: 'panel', icon: '✨', label: 'Guía rápida' },
        { id: 'empresa', icon: '🏢', label: 'Nombre y contacto' },
      ],
    },
    {
      title: 'Menú del sitio',
      items: [{ id: 'paginas', icon: '📋', label: 'Páginas visibles' }],
    },
    {
      title: 'Página principal',
      items: [
        { id: 'inicio', icon: '🏠', label: 'Bloques del inicio' },
        { id: 'contenido', icon: '✏️', label: 'Textos del inicio' },
      ],
    },
    {
      title: 'Más páginas',
      items: [
        { id: 'institucional', icon: '🏛️', label: 'Quiénes somos' },
        { id: 'blog', icon: '📰', label: 'Blog' },
      ],
    },
    {
      title: 'Diseño',
      items: [
        { id: 'apariencia', icon: '🎨', label: 'Colores y estilo' },
        { id: 'marca', icon: '©', label: 'Pie de página' },
      ],
    },
  ];

  panel = signal<BuilderPanel>('panel');
  previewVisible = signal(true);
  aparienciaAvanzada = signal(false);

  get landing() {
    if (!this.portalForm.landing) {
      this.portalForm.landing = mergePortalLanding();
    } else if (!this.portalForm.landing.blog) {
      this.portalForm.landing.blog = { ...mergePortalLanding().blog };
    }
    return this.portalForm.landing;
  }

  get site(): PortalSiteConfig {
    if (!this.portalForm.site) {
      this.portalForm.site = mergePortalSiteDefaults();
    }
    return this.portalForm.site;
  }

  panelInfo(): PanelInfo {
    const map: Record<BuilderPanel, PanelInfo> = {
      panel: {
        title: 'Guía rápida',
        help: 'Siga estos pasos en orden. A la derecha ve cómo quedará su sitio antes de publicar.',
      },
      empresa: {
        title: 'Nombre y contacto de su empresa',
        help: 'Escriba aquí el nombre que debe verse en el menú, el encabezado y el pie del sitio. También teléfono, dirección y correo.',
      },
      paginas: {
        title: 'Páginas del menú',
        help: 'Active o desactive páginas y cambie cómo se llaman en el menú superior (por ejemplo «Fundación» → «Nuestra empresa»).',
      },
      inicio: {
        title: 'Bloques de la página principal',
        help: 'Encienda o apague secciones del inicio y use las flechas para cambiar el orden. Mire la vista previa a la derecha.',
      },
      contenido: {
        title: 'Textos de la página principal',
        help: 'Edite frases, preguntas frecuentes, testimonios y demás textos que aparecen en el inicio del sitio.',
      },
      institucional: {
        title: 'Página «Quiénes somos»',
        help: 'Misión, visión, quiénes somos y servicios. Ideal si renombró «Fundación» por «Empresa» o «Institución».',
      },
      blog: {
        title: 'Página Blog',
        help: 'Encabezado y textos de la página /blog. Los artículos se publican en Aula virtual → Blog del portal.',
      },
      apariencia: {
        title: 'Colores y estilo',
        help: 'Elija los colores de su marca y suba la imagen del banner. La foto se guarda al instante; los colores requieren publicar cambios.',
      },
      marca: {
        title: 'Pie de página',
        help: 'Texto junto al logo (año y frase corta), derechos de autor al final y referencias del desarrollador.',
      },
    };
    return map[this.panel()];
  }

  pasosGuia(): GuiaPaso[] {
    return [
      {
        num: 1,
        titulo: 'Ponga el nombre de su empresa',
        texto: 'Es lo primero. Así deja de aparecer el nombre de ejemplo en el sitio.',
        panel: 'empresa',
        listo: () => !!this.portalForm.nombreEmpresa?.trim(),
      },
      {
        num: 2,
        titulo: 'Elija qué páginas mostrar',
        texto: 'Decida qué enlaces verán sus visitantes en el menú.',
        panel: 'paginas',
        listo: () => true,
      },
      {
        num: 3,
        titulo: 'Ajuste colores (opcional)',
        texto: 'Use los colores de su marca si lo desea.',
        panel: 'apariencia',
        listo: () => true,
      },
      {
        num: 4,
        titulo: 'Ordene el inicio',
        texto: 'Active solo los bloques que necesita y ordénelos.',
        panel: 'inicio',
        listo: () => true,
      },
      {
        num: 5,
        titulo: 'Publique los cambios',
        texto: 'Hasta que no pulse el botón azul de abajo, los visitantes no verán sus cambios.',
        panel: 'panel',
        listo: () => false,
      },
    ];
  }

  pasosCompletados(): number {
    return this.pasosGuia().filter((p) => p.listo()).length;
  }

  seccionesInicio(): { id: string; label: string; activa: boolean }[] {
    const s = this.site;
    const labels = { ...PORTAL_HOME_SECCIONES_LABELS, ...s.homeSeccionesLabels };
    const orden =
      s.home.orden?.length ? s.home.orden : s.homeSeccionesOrden || Object.keys(s.home.secciones || {});
    return orden.map((id) => ({
      id,
      label: labels[id] || id,
      activa: s.home.secciones[id] !== false,
    }));
  }

  setPanel(id: BuilderPanel) {
    this.panel.set(id);
  }

  togglePreview() {
    this.previewVisible.update((v) => !v);
  }

  togglePagina(key: string, activa: boolean) {
    const p = this.site.paginas[key as keyof typeof this.site.paginas];
    if (p) p.activa = activa;
  }

  toggleSeccion(id: string, activa: boolean) {
    if (!this.site.home.secciones) this.site.home.secciones = {};
    this.site.home.secciones[id] = activa;
  }

  moverSeccion(id: string, dir: -1 | 1) {
    const orden = [...(this.site.home.orden || this.seccionesInicio().map((x) => x.id))];
    const i = orden.indexOf(id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    this.site.home.orden = orden;
  }

  paginasActivas(): number {
    return this.paginaMeta.filter((p) => this.site.paginas[p.key]?.activa !== false).length;
  }

  seccionesActivas(): number {
    return this.seccionesInicio().filter((s) => s.activa).length;
  }

  paginaSiempreVisible(key: string): boolean {
    return key === 'home' || key === 'aula';
  }

  themePreviewVars(): Record<string, string> {
    return buildPortalThemeCssVars(this.site.tema);
  }

  tieneImagenHero(): boolean {
    return !!this.site.tema?.urlHero?.trim();
  }

  heroPreviewUrl(): string | null {
    const abs = this.site.tema?.urlHeroAbsoluta?.trim();
    if (abs) return abs;
    const rel = this.site.tema?.urlHero?.trim();
    if (!rel) return null;
    if (/^https?:\/\//i.test(rel)) return rel;
    if (rel.startsWith('/')) return rel;
    const base = environment.uploadsUrl.replace(/\/+$/, '');
    return `${base}/${rel.replace(/^\/+/, '')}`;
  }

  onHeroImagen(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.heroUploading.set(true);
    this.svc
      .subirImagenHeroPortal(file)
      .pipe(finalize(() => {
        this.heroUploading.set(false);
        input.value = '';
      }))
      .subscribe({
        next: (res) => {
          this.applyPortalConfig(res.config);
          this.avNotice.emit({ message: res.message || 'Imagen del banner actualizada' });
        },
        error: (e) => {
          this.avNotice.emit({
            message: e?.error?.message || 'No se pudo subir la imagen del banner',
            error: true,
          });
        },
      });
  }

  quitarImagenHero() {
    this.heroUploading.set(true);
    this.svc
      .quitarImagenHeroPortal()
      .pipe(finalize(() => this.heroUploading.set(false)))
      .subscribe({
        next: (res) => {
          this.applyPortalConfig(res.config);
          this.avNotice.emit({ message: res.message || 'Imagen del banner eliminada' });
        },
        error: (e) => {
          this.avNotice.emit({
            message: e?.error?.message || 'No se pudo quitar la imagen del banner',
            error: true,
          });
        },
      });
  }

  private applyPortalConfig(config: PortalAulaConfig) {
    Object.assign(this.portalForm, config);
    this.portalForm.landing = mergePortalLanding(config.landing);
    this.portalForm.site = mergePortalSiteDefaults(config.site);
  }

  /** Primera línea de acercaDeHtml: aparece bajo el nombre en el pie del sitio. */
  footerFraseCorta(): string {
    const lines = String(this.portalForm.acercaDeHtml ?? '')
      .split('\n')
      .map((l) => l.trim());
    return lines.find(Boolean) ?? '';
  }

  setFooterFraseCorta(value: string) {
    const lines = String(this.portalForm.acercaDeHtml ?? '').split('\n');
    const idx = lines.findIndex((l) => l.trim());
    if (idx === -1) {
      this.portalForm.acercaDeHtml = value.trim();
      return;
    }
    lines[idx] = value;
    this.portalForm.acercaDeHtml = lines.join('\n');
  }
}
