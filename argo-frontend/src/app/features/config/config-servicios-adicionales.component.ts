import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { CatalogoService } from '../../core/services/catalogo.service';
import { Programa, ProgramaService } from '../../core/services/programa.service';
import { ServicioCatalogoService } from '../../core/services/servicio-catalogo.service';
import {
  ConfigServiciosAdicionalesService,
  MomentoServicioAdicional,
  ReglaServicioAdicional,
} from '../../core/services/config-servicios-adicionales.service';
import { ArgoSwitchComponent } from '../../shared/argo-switch/argo-switch.component';
import {
  MODALIDADES_PROGRAMA_OPTS,
} from '../programas/programa-modalidad.helpers';
import { TARIFA_VIRTUAL } from '../alumnos/catalogo.helpers';

interface TipoCapRow {
  /** Clave única para DOM / @for track (evita switches enlazados si idTipCap se repite). */
  uid: string;
  idTipCap: string;
  label: string;
}

interface TipoPagoRow {
  id: string;
  label: string;
}

function nuevoIdRegla(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Misma lógica que backend: prefijo numérico de idTipCap legacy. */
function canonTipCapId(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d+)/);
  return m ? m[1] : s;
}

function normalizarTiposCapCatalogo(rows: Record<string, unknown>[]): TipoCapRow[] {
  const porCanon = new Map<string, TipoCapRow>();
  for (const r of rows || []) {
    const idRaw = String(r['idTipCap'] ?? r['id'] ?? '').trim();
    if (!idRaw) continue;
    const canon = canonTipCapId(idRaw);
    if (!canon) continue;
    const label = String(r['tipoCap'] || r['descripcion'] || r['nombre'] || canon).trim();
    const uid = String(r['_id'] ?? `${canon}::${label}`).trim();
    const row: TipoCapRow = { uid, idTipCap: canon, label };
    const prev = porCanon.get(canon);
    if (!prev || label.length > prev.label.length) {
      porCanon.set(canon, row);
    }
  }
  return [...porCanon.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

function normalizarIdTipCaps(ids: string[] | undefined): string[] {
  return [...new Set((ids || []).map((id) => canonTipCapId(id)).filter(Boolean))];
}

function nuevaRegla(orden: number): ReglaServicioAdicional {
  return {
    id: nuevoIdRegla(),
    activo: true,
    idServ: '',
    momento: 'matricula',
    modalidades: [],
    tarifasMatricula: [],
    idTipCaps: [],
    prefijosCodigo: [],
    idProgramas: [],
    idTiposPago: [],
    repartirSemestres: false,
    orden,
    nota: '',
  };
}

@Component({
  selector: 'argo-config-servicios-adicionales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ArgoSwitchComponent],
  templateUrl: './config-servicios-adicionales.component.html',
  styleUrls: ['./config-servicios-adicionales.component.scss'],
})
export class ConfigServiciosAdicionalesComponent implements OnInit {
  private cfgSvc = inject(ConfigServiciosAdicionalesService);
  private servCatSvc = inject(ServicioCatalogoService);
  private catSvc = inject(CatalogoService);
  private progSvc = inject(ProgramaService);

  readonly modalidadesOpts = MODALIDADES_PROGRAMA_OPTS;
  readonly tarifasOpts = [
    { value: 1, label: 'Tarifa 1' },
    { value: 2, label: 'Tarifa 2' },
    { value: 3, label: 'Tarifa 3' },
    { value: TARIFA_VIRTUAL, label: 'Virtual (4)' },
  ];
  readonly momentos: { value: MomentoServicioAdicional; label: string; hint: string }[] = [
    {
      value: 'matricula',
      label: 'Al matricular',
      hint: 'Se liquida al crear la matrícula (ej. derechos de grado en técnicos).',
    },
    {
      value: 'pago',
      label: 'Al cobrar recibo',
      hint: 'Se liquida cada vez que se registra un pago con el tipo de pago indicado (ej. pasarela).',
    },
  ];

  reglas = signal<ReglaServicioAdicional[]>([]);
  serviciosGlobales = signal<{ idServ: string; label: string; valor: number }[]>([]);
  programas = signal<Programa[]>([]);
  /** Búsqueda de programas por regla (clave = id de regla). */
  buscarProgramasPorRegla = signal<Record<string, string>>({});
  tiposCap = signal<TipoCapRow[]>([]);
  tiposPago = signal<TipoPagoRow[]>([]);

  loading = signal(true);
  saving = signal(false);
  msg = signal<string | null>(null);
  msgError = signal(false);

  reglasActivas = computed(() => this.reglas().filter((r) => r.activo !== false));

  ngOnInit(): void {
    this.servCatSvc.listar({ sinPrograma: true, catalogo: true, limit: 200 }).subscribe({
      next: (rows) => {
        this.serviciosGlobales.set(
          (rows || []).map((s) => ({
            idServ: String(s.idServ ?? s._id ?? ''),
            label: String(s.descrServicio || s.descripcion || s.idServ || '').trim(),
            valor: Number(s.tarifa1) || 0,
          })),
        );
      },
    });

    this.catSvc.list('catTipoCapacitacion').subscribe({
      next: (rows) => {
        this.tiposCap.set(normalizarTiposCapCatalogo(rows || []));
      },
    });

    this.catSvc.list('catTipoPago').subscribe({
      next: (rows) => {
        this.tiposPago.set(
          (rows || [])
            .map((r: Record<string, unknown>) => ({
              id: String(r['idTipoPago'] ?? r['codigo'] ?? r['id'] ?? '').trim(),
              label: String(r['descripcion'] || r['nombre'] || r['idTipoPago'] || '').trim(),
            }))
            .filter((t) => t.id),
        );
      },
    });

    this.progSvc.listar({ catalogo: true, limit: 500 }).subscribe({
      next: (rows) => this.programas.set(rows || []),
      error: () => this.programas.set([]),
    });

    this.cfgSvc.obtener().subscribe({
      next: (c) => {
        this.reglas.set(
          (c.reglas || []).map((r) => ({
            ...r,
            idTipCaps: normalizarIdTipCaps(r.idTipCaps),
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.setMsg('No se pudo cargar la configuración.', true);
      },
    });
  }

  agregarRegla(): void {
    this.reglas.update((list) => [...list, nuevaRegla(list.length)]);
  }

  quitarRegla(i: number): void {
    this.reglas.update((list) => list.filter((_, idx) => idx !== i));
  }

  patchRegla(i: number, patch: Partial<ReglaServicioAdicional>): void {
    this.reglas.update((list) => {
      const copy = [...list];
      copy[i] = { ...copy[i], ...patch };
      if (patch.momento === 'matricula') copy[i].idTiposPago = [];
      if (patch.momento === 'pago') copy[i].tarifasMatricula = [];
      return copy;
    });
  }

  toggleModalidad(i: number, codigo: string, checked: boolean): void {
    const r = this.reglas()[i];
    const set = new Set(r.modalidades || []);
    if (checked) set.add(codigo);
    else set.delete(codigo);
    this.patchRegla(i, { modalidades: [...set] });
  }

  tieneModalidad(i: number, codigo: string): boolean {
    return (this.reglas()[i]?.modalidades || []).includes(codigo);
  }

  toggleTarifa(i: number, tarifa: number, checked: boolean): void {
    const r = this.reglas()[i];
    const set = new Set(r.tarifasMatricula || []);
    if (checked) set.add(tarifa);
    else set.delete(tarifa);
    this.patchRegla(i, { tarifasMatricula: [...set].sort((a, b) => a - b) });
  }

  tieneTarifa(i: number, tarifa: number): boolean {
    return (this.reglas()[i]?.tarifasMatricula || []).includes(tarifa);
  }

  toggleTipCap(i: number, id: string, checked: boolean): void {
    const canon = canonTipCapId(id);
    if (!canon) return;
    const r = this.reglas()[i];
    const set = new Set(normalizarIdTipCaps(r.idTipCaps));
    if (checked) set.add(canon);
    else set.delete(canon);
    this.patchRegla(i, { idTipCaps: [...set] });
  }

  tieneTipCap(i: number, id: string): boolean {
    const canon = canonTipCapId(id);
    if (!canon) return false;
    return normalizarIdTipCaps(this.reglas()[i]?.idTipCaps).includes(canon);
  }

  toggleTipoPago(i: number, id: string, checked: boolean): void {
    const r = this.reglas()[i];
    const set = new Set(r.idTiposPago || []);
    if (checked) set.add(id);
    else set.delete(id);
    this.patchRegla(i, { idTiposPago: [...set] });
  }

  tieneTipoPago(i: number, id: string): boolean {
    return (this.reglas()[i]?.idTiposPago || []).includes(id);
  }

  patchPrefijos(i: number, raw: string): void {
    const prefijosCodigo = raw
      .split(/[,;\s]+/)
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    this.patchRegla(i, { prefijosCodigo });
  }

  prefijosTexto(r: ReglaServicioAdicional): string {
    return (r.prefijosCodigo || []).join(', ');
  }

  idProgramaStr(p: Programa): string {
    return String(p.idPrograma ?? p._id ?? '').trim();
  }

  buscarProgramaRegla(reglaId: string): string {
    return this.buscarProgramasPorRegla()[reglaId] || '';
  }

  setBuscarProgramaRegla(reglaId: string, q: string): void {
    this.buscarProgramasPorRegla.update((m) => ({ ...m, [reglaId]: q }));
  }

  programasFiltradosRegla(reglaId: string): Programa[] {
    const q = this.buscarProgramaRegla(reglaId).trim().toLowerCase();
    const list = this.programas();
    if (!q) return list;
    return list.filter(
      (p) =>
        String(p.nombreProg || '').toLowerCase().includes(q) ||
        String(p.codigoProg || '').toLowerCase().includes(q) ||
        this.idProgramaStr(p).includes(q),
    );
  }

  togglePrograma(i: number, idPrograma: string, checked: boolean): void {
    const id = String(idPrograma).trim();
    if (!id) return;
    const r = this.reglas()[i];
    const set = new Set((r.idProgramas || []).map(String));
    if (checked) set.add(id);
    else set.delete(id);
    this.patchRegla(i, { idProgramas: [...set] });
  }

  tienePrograma(i: number, idPrograma: string): boolean {
    const id = String(idPrograma).trim();
    return (this.reglas()[i]?.idProgramas || []).some((x) => String(x).trim() === id);
  }

  limpiarProgramasRegla(i: number): void {
    this.patchRegla(i, { idProgramas: [] });
  }

  cantidadProgramasRegla(r: ReglaServicioAdicional): number {
    return (r.idProgramas || []).filter((id) => String(id).trim()).length;
  }

  programaLabel(id: string): string {
    const idStr = String(id).trim();
    const p = this.programas().find((x) => this.idProgramaStr(x) === idStr);
    if (!p) return idStr;
    const cod = String(p.codigoProg || '').trim();
    return cod ? `${cod} — ${p.nombreProg}` : p.nombreProg;
  }

  servicioLabel(idServ: string): string {
    const s = this.serviciosGlobales().find((x) => x.idServ === String(idServ));
    if (!s) return idServ || '—';
    return s.valor > 0 ? `${s.label} ($${s.valor.toLocaleString('es-CO')})` : s.label;
  }

  guardar(): void {
    const reglas = this.reglas();
    for (let i = 0; i < reglas.length; i++) {
      const r = reglas[i];
      if (!r.idServ) {
        this.setMsg(`Regla ${i + 1}: seleccione un servicio del catálogo (sin programa).`, true);
        return;
      }
      if (r.momento === 'pago' && !(r.idTiposPago?.length)) {
        this.setMsg(`Regla ${i + 1}: indique al menos un tipo de pago (pasarela).`, true);
        return;
      }
    }

    this.saving.set(true);
    this.setMsg(null, false);
    const reglasNorm = reglas.map((r) => ({
      ...r,
      idTipCaps: normalizarIdTipCaps(r.idTipCaps),
    }));
    this.cfgSvc.guardar({ reglas: reglasNorm }).subscribe({
      next: (c) => {
        this.reglas.set([...(c.reglas || [])]);
        this.saving.set(false);
        this.setMsg('Configuración guardada.', false);
      },
      error: (e) => {
        this.saving.set(false);
        this.setMsg(e?.error?.message || 'Error al guardar.', true);
      },
    });
  }

  private setMsg(text: string | null, isErr: boolean): void {
    this.msg.set(text);
    this.msgError.set(isErr);
  }
}
