import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CatalogoService, MunicipioDivipola } from '../../core/services/catalogo.service';
import { Cliente, ClienteCatalogos, ClienteService } from '../../core/services/cliente.service';
import { AsistenteContextoService } from '../../core/services/asistente-contexto.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { MunicipioBuscarComponent } from '../alumnos/municipio-buscar.component';

@Component({
  selector: 'argo-config-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, MunicipioBuscarComponent],
  templateUrl: './config-clientes.component.html',
  styleUrls: ['./config-clientes.component.scss'],
})
export class ConfigClientesComponent implements OnInit {
  private svc = inject(ClienteService);
  private catSvc = inject(CatalogoService);
  private asistente = inject(AsistenteContextoService);
  private confirm = inject(ConfirmDialogService);

  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  clientes = signal<Cliente[]>([]);
  filtro = signal('');
  catalogos = signal<ClienteCatalogos | null>(null);

  modalAbierto = signal(false);
  editId = signal<string | null>(null);
  form = signal<Cliente>(this.vacio());
  /** Texto del buscador Divipola (independiente del form para no pisar lo que escribe el usuario). */
  municipioTexto = signal('');

  private vacio(): Cliente {
    return {
      identificationDocumentCode: '31',
      identificacion: '',
      dv: '',
      legalOrganizationCode: '1',
      razonSocial: '',
      nombreComercial: '',
      nombres: '',
      tributeCode: 'ZZ',
      responsabilidadFiscal: 'R-99-PN',
      direccion: '',
      correo: '',
      telefono: '',
      municipioCodigo: '',
      municipioNombre: '',
      tipoContratoCap: '',
      granContribuyente: false,
      autoretenedor: false,
      agenteRetenedorIva: false,
      porcentajeReteIva: 0,
      porcentajeReteFuente: 0,
      activo: true,
    };
  }

  ngOnInit(): void {
    this.svc.catalogos().subscribe({
      next: (c) => this.catalogos.set(c),
      error: () => this.catalogos.set(null),
    });
    this.recargar();
  }

  recargar(): void {
    this.loading.set(true);
    this.svc.listar(this.filtro()).subscribe({
      next: (rows) => {
        this.clientes.set(rows || []);
        this.loading.set(false);
      },
      error: () => {
        this.clientes.set([]);
        this.loading.set(false);
      },
    });
  }

  patch(p: Partial<Cliente>): void {
    this.form.set({ ...this.form(), ...p });
  }

  nuevo(): void {
    this.editId.set(null);
    this.form.set(this.vacio());
    this.municipioTexto.set('');
    this.msg.set(null);
    this.modalAbierto.set(true);
    this.asistente.setOverride('facturacion.clientes');
  }

  editar(c: Cliente): void {
    this.editId.set(c._id || null);
    this.form.set({ ...this.vacio(), ...c });
    this.municipioTexto.set(c.municipioNombre || '');
    this.normalizarMunicipioCliente(c);
    this.msg.set(null);
    this.modalAbierto.set(true);
    this.asistente.setOverride('facturacion.clientes');
  }

  cerrar(): void {
    this.modalAbierto.set(false);
    this.asistente.setOverride(null);
  }

  onMunicipio(m: MunicipioDivipola): void {
    this.municipioTexto.set(m.label || m.nombreMunicipio);
    this.patch({
      municipioCodigo: m.codMunicipio,
      municipioNombre: m.nombreMunicipio,
    });
  }

  onMunicipioLimpiado(): void {
    this.municipioTexto.set('');
    this.patch({ municipioCodigo: '', municipioNombre: '' });
  }

  onMunicipioTexto(v: string): void {
    this.municipioTexto.set(v);
    if (!v.trim()) {
      this.patch({ municipioCodigo: '', municipioNombre: '' });
    }
  }

  private normalizarMunicipioCliente(c: Cliente): void {
    const cod = String(c.municipioCodigo || '').trim();
    if (/^\d{5}$/.test(cod)) {
      this.catSvc.municipioPorCodigo(cod).subscribe({
        next: (m) => {
          this.municipioTexto.set(m.label || m.nombreMunicipio);
          this.patch({
            municipioCodigo: m.codMunicipio,
            municipioNombre: m.nombreMunicipio,
          });
        },
        error: () => {
          /* conserva datos guardados */
        },
      });
      return;
    }
    const nombre = String(c.municipioNombre || cod || '').trim();
    if (!nombre || /^\d+$/.test(nombre)) return;
    this.catSvc.buscarMunicipios(nombre, 5).subscribe({
      next: (rows) => {
        const norm = this.sinAcentos(nombre);
        const hit =
          rows.find((r) => this.sinAcentos(r.nombreMunicipio) === norm) ||
          rows.find((r) => this.sinAcentos(r.nombreMunicipio).includes(norm));
        if (hit) {
          this.municipioTexto.set(hit.label || hit.nombreMunicipio);
          this.patch({
            municipioCodigo: hit.codMunicipio,
            municipioNombre: hit.nombreMunicipio,
          });
        }
      },
    });
  }

  private sinAcentos(texto: string): string {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  guardar(): void {
    const f = this.form();
    if (!f.identificacion?.trim() || !(f.razonSocial?.trim() || f.nombres?.trim())) {
      this.msgError.set(true);
      this.msg.set('Identificación y razón social / nombre son obligatorios');
      return;
    }
    if (!/^\d{5}$/.test(String(f.municipioCodigo || '').trim())) {
      this.msgError.set(true);
      this.msg.set('Seleccione el municipio desde el catálogo Divipola (nombre → código automático).');
      return;
    }
    if (!String(f.tipoContratoCap || '').trim()) {
      this.msgError.set(true);
      this.msg.set('Seleccione el tipo de contratante (define IVA y retenciones al facturar contratos).');
      return;
    }
    this.saving.set(true);
    const obs = this.editId() ? this.svc.actualizar(this.editId()!, f) : this.svc.crear(f);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalAbierto.set(false);
        this.msgError.set(false);
        this.msg.set('Cliente guardado');
        this.recargar();
      },
      error: (e) => {
        this.saving.set(false);
        this.msgError.set(true);
        this.msg.set(e?.error?.message || 'No se pudo guardar el cliente');
      },
    });
  }

  async eliminar(c: Cliente): Promise<void> {
    if (!c._id) return;
    const ok = await this.confirm.open({
      title: 'Desactivar cliente',
      message: `¿Desactivar el cliente «${c.nombre || c.identificacion}»?`,
      confirmLabel: 'Desactivar',
      variant: 'danger',
    });
    if (!ok) return;
    this.svc.eliminar(c._id).subscribe({ next: () => this.recargar() });
  }

  esJuridica(): boolean {
    return String(this.form().legalOrganizationCode || '1') === '1';
  }

  esNit(): boolean {
    return String(this.form().identificationDocumentCode || '') === '31';
  }

  labelTipoContratoCap(id?: string): string {
    const t = this.catalogos()?.tiposContratoCap?.find((x) => x.id === id);
    return t?.label || id || '—';
  }

  onTipoContratoCap(tipo: string): void {
    const patch: Partial<Cliente> = { tipoContratoCap: tipo };
    if (tipo === 'persona_natural') {
      patch.legalOrganizationCode = '2';
      if (this.form().identificationDocumentCode === '31') {
        patch.identificationDocumentCode = '13';
        patch.dv = '';
      }
    } else if (tipo) {
      patch.legalOrganizationCode = '1';
    }
    this.patch(patch);
  }

  onTipoIdentificacion(code: string): void {
    const patch: Partial<Cliente> = { identificationDocumentCode: code };
    if (code === '31') {
      patch.legalOrganizationCode = '1';
    } else if (['13', '12', '22', '41'].includes(code)) {
      patch.legalOrganizationCode = '2';
      patch.dv = '';
    }
    this.patch(patch);
  }

  onGranContribuyente(v: boolean): void {
    const patch: Partial<Cliente> = { granContribuyente: v };
    if (v && this.form().responsabilidadFiscal === 'R-99-PN') {
      patch.responsabilidadFiscal = 'O-13';
    }
    this.patch(patch);
  }

  onAutoretenedor(v: boolean): void {
    const patch: Partial<Cliente> = { autoretenedor: v };
    if (v && this.form().responsabilidadFiscal === 'R-99-PN') {
      patch.responsabilidadFiscal = 'O-15';
    }
    this.patch(patch);
  }

  onAgenteRetenedor(v: boolean): void {
    const patch: Partial<Cliente> = { agenteRetenedorIva: v };
    if (v) {
      if (this.form().responsabilidadFiscal === 'R-99-PN') {
        patch.responsabilidadFiscal = 'O-23';
      }
      if (!this.form().porcentajeReteIva) patch.porcentajeReteIva = 15;
    }
    this.patch(patch);
  }
}
