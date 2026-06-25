import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export type SedeCatalogoMode = 'todos' | 'tipos' | 'especificos';

export interface SedeDto {
  idSede: string;
  nombre: string;
  codigo?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  codMunicipio?: string;
  lat?: number | null;
  lng?: number | null;
  deteGeorefe?: string;
  telefono?: string;
  activa?: boolean;
  esPrincipal?: boolean;
  programasMode?: SedeCatalogoMode;
  programasTiposPermitidos?: string[];
  programasIdsPermitidos?: number[];
  serviciosMode?: SedeCatalogoMode;
  serviciosTiposPermitidos?: string[];
  serviciosIdsPermitidos?: number[];
}

const SEDE_KEY = 'argo_sede_activa';

@Injectable({ providedIn: 'root' })
export class SedeService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/sedes`;

  private _activa = signal<SedeDto | null>(this.readStored());

  activa = computed(() => this._activa());
  idSede = computed(() => this._activa()?.idSede || '');

  labelActiva = computed(() => {
    const s = this._activa();
    return s ? `${s.nombre}${s.codigo ? ` (${s.codigo})` : ''}` : 'Sin sede';
  });

  listarMias(): Observable<SedeDto[]> {
    return this.http.get<SedeDto[]>(`${this.base}/mias`);
  }

  listar(): Observable<SedeDto[]> {
    return this.http.get<SedeDto[]>(this.base);
  }

  crear(dto: Partial<SedeDto>): Observable<SedeDto> {
    return this.http.post<SedeDto>(this.base, dto);
  }

  actualizar(idSede: string, dto: Partial<SedeDto>): Observable<SedeDto> {
    return this.http.patch<SedeDto>(`${this.base}/${encodeURIComponent(idSede)}`, dto);
  }

  seleccionar(sede: SedeDto | null): void {
    if (sede?.idSede) {
      localStorage.setItem(SEDE_KEY, JSON.stringify(sede));
      this._activa.set(sede);
    } else {
      localStorage.removeItem(SEDE_KEY);
      this._activa.set(null);
    }
  }

  /**
   * @param filtrarComoAdmin true solo para admin: puede cambiar sede (filtro).
   * Usuarios normales quedan fijos en su sede asignada.
   */
  initDesdeUsuario(sedes?: SedeDto[], options?: { filtrarComoAdmin?: boolean }): void {
    const lista = sedes || [];
    if (!lista.length) {
      this.seleccionar(null);
      return;
    }

    if (!options?.filtrarComoAdmin) {
      const asignada = lista.find((s) => s.esPrincipal) || lista[0];
      if (asignada) this.seleccionar(asignada);
      return;
    }

    const stored = this.readStored();
    if (stored && lista.some((s) => s.idSede === stored.idSede)) {
      this._activa.set(stored);
      return;
    }
    const principal = lista.find((s) => s.esPrincipal) || lista[0] || null;
    if (principal) this.seleccionar(principal);
  }

  private readStored(): SedeDto | null {
    try {
      const raw = localStorage.getItem(SEDE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SedeDto;
    } catch {
      return null;
    }
  }
}
