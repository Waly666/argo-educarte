import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface FacturacionResumen {
  emitidas: number;
  validadas: number;
  rechazadas: number;
  modoDesarrollo: number;
  proveedor: string;
  modoEmision: string;
  listoParaFactus: boolean;
}

export interface LiquidacionElegibleFe {
  _id: string;
  numDoc: number;
  idServ?: string;
  idProg?: string;
  descripcion?: string;
  valor: number;
  abonado: number;
  saldo: number;
  porcentajeIva?: number;
  condicionIva?: string;
  servicioDescr?: string;
}

export interface FacturaItem {
  idLiquidacion?: string;
  descripcion?: string;
  condicionIva?: string;
  porcentajeIva?: number;
  valorLiquidacion?: number;
  base?: number;
  valorIva?: number;
  total?: number;
}

export interface FacturaElectronicaItem {
  _id: string;
  numDoc?: number;
  referenceCode?: string;
  proveedor?: string;
  ambiente?: string;
  modoDesarrollo?: boolean;
  estado?: string;
  numeroFactura?: string;
  prefijo?: string;
  cufe?: string;
  formaPago?: string;
  base?: number;
  valorIva?: number;
  valorTotal?: number;
  reteIvaAplica?: boolean;
  reteIvaPorcentaje?: number;
  reteIvaValor?: number;
  adquirente?: {
    tipo?: string;
    nombre?: string;
    identificacion?: string;
    participanteNombre?: string;
    participanteNumDoc?: number;
  };
  items?: FacturaItem[];
  urlPdf?: string;
  urlQr?: string;
  emitidaAt?: string;
  createdAt?: string;
}

export interface FacturacionCatalogos {
  proveedores: { id: string; label: string }[];
  ambientes: { id: string; label: string }[];
  modosEmision: { id: string; label: string }[];
  condicionesIva: { id: string; label: string }[];
  conceptosNotaCredito?: { id: string; label: string }[];
}

export interface NotaCreditoItem {
  idLiquidacion?: string;
  descripcion?: string;
  condicionIva?: string;
  porcentajeIva?: number;
  base?: number;
  valorIva?: number;
  total?: number;
}

export interface NotaCreditoElectronica {
  _id: string;
  idFactura?: string;
  numeroNota?: string;
  tipo?: string;
  conceptoCorreccion?: string;
  estado?: string;
  modoDesarrollo?: boolean;
  valorTotal?: number;
  motivo?: string;
  facturaNumero?: string;
  urlPdf?: string;
  createdAt?: string;
}

export interface NotaCreditoPayload {
  tipo: 'total' | 'parcial';
  conceptoCorreccion: string;
  idLiquidaciones?: string[];
  motivo?: string;
}

export interface PreviewNotaCredito {
  tipo: string;
  conceptoCorreccion: string;
  detalle: NotaCreditoItem[];
  totales: { base: number; valorIva: number; total: number };
}

export interface PreviewFacturaContrato {
  contrato: { _id?: string; codContrato?: string; tipoContrato?: string; objetoContrato?: string };
  regla: { label?: string; condicionIva?: string; descuentoPorcentaje?: number };
  totales: { base: number; valorIva: number; total: number };
  retenciones: {
    reteIva: { aplica: boolean; porcentaje: number; valor: number };
    reteFuente: { aplica: boolean; porcentaje: number; valor: number };
    reteIca: { aplica: boolean; porcentaje: number; valor: number };
  };
  adquirente: {
    nombre: string;
    identificacion?: string;
    granContribuyente?: boolean;
    autoretenedor?: boolean;
    agenteRetenedorIva?: boolean;
    porcentajeReteIva?: number;
    porcentajeReteFuente?: number;
    tipoContratoCap?: string;
  };
  detalle: { descripcion?: string };
}

export interface PreviewFactura {
  totales: { base: number; valorIva: number; total: number; formaPago: string; esCredito: boolean };
  detalle: FacturaItem[];
  reteIva: { aplica: boolean; porcentaje: number; valor: number };
  adquirente: { tipo: string; nombre: string };
  lineaFactus?: { consolidada: boolean; nombre: string | null; servicios: number };
}

export interface EmisionPayload {
  numDoc: number;
  idLiquidaciones: string[];
  tipoAdquirente: 'alumno' | 'cliente';
  idCliente?: string | null;
}

export interface FacturacionLista<T> {
  total: number;
  items: T[];
}

@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/facturacion`;

  resumen(): Observable<FacturacionResumen> {
    return this.http.get<FacturacionResumen>(`${this.base}/resumen`);
  }

  catalogos(): Observable<FacturacionCatalogos> {
    return this.http.get<FacturacionCatalogos>(`${this.base}/catalogos`);
  }

  elegiblesAlumno(numDoc: number | string): Observable<LiquidacionElegibleFe[]> {
    return this.http.get<LiquidacionElegibleFe[]>(`${this.base}/elegibles/${numDoc}`);
  }

  /** Facturas emitidas para un alumno (incluye facturación a empresa/tercero). */
  listarPorAlumno(numDoc: number | string): Observable<FacturaElectronicaItem[]> {
    return this.http.get<FacturaElectronicaItem[]>(`${this.base}/alumno/${numDoc}`);
  }

  estadoFacturaContrato(idContrato: string): Observable<{
    facturado: boolean;
    factura: { _id: string; numeroFactura: string; estado: string; valorTotal: number } | null;
  }> {
    return this.http.get<{
      facturado: boolean;
      factura: { _id: string; numeroFactura: string; estado: string; valorTotal: number } | null;
    }>(`${this.base}/contrato/${idContrato}/estado`);
  }

  previewFacturaContrato(idContrato: string): Observable<PreviewFacturaContrato> {
    return this.http.get<PreviewFacturaContrato>(`${this.base}/contrato/${idContrato}/preview`);
  }

  emitirFacturaContrato(idContrato: string): Observable<FacturaElectronicaItem> {
    return this.http.post<FacturaElectronicaItem>(`${this.base}/contrato/${idContrato}/emitir`, {});
  }

  listar(q = '', skip = 0, limit = 200): Observable<FacturacionLista<FacturaElectronicaItem>> {
    return this.http.get<FacturacionLista<FacturaElectronicaItem>>(this.base, {
      params: { q, skip: String(skip), limit: String(limit) },
    });
  }

  obtener(id: string): Observable<FacturaElectronicaItem & { payloadEnviado?: unknown }> {
    return this.http.get<FacturaElectronicaItem & { payloadEnviado?: unknown }>(`${this.base}/${id}`);
  }

  preview(body: EmisionPayload): Observable<PreviewFactura> {
    return this.http.post<PreviewFactura>(`${this.base}/preview`, body);
  }

  emitir(body: EmisionPayload): Observable<FacturaElectronicaItem> {
    return this.http.post<FacturaElectronicaItem>(`${this.base}/emitir`, body);
  }

  probarConexion(): Observable<{ ok: boolean; message: string; modo?: string }> {
    return this.http.post<{ ok: boolean; message: string; modo?: string }>(`${this.base}/probar-conexion`, {});
  }

  notaCreditoPreview(idFactura: string, body: NotaCreditoPayload): Observable<PreviewNotaCredito> {
    return this.http.post<PreviewNotaCredito>(`${this.base}/${idFactura}/nota-credito/preview`, body);
  }

  notaCreditoEmitir(idFactura: string, body: NotaCreditoPayload): Observable<NotaCreditoElectronica> {
    return this.http.post<NotaCreditoElectronica>(`${this.base}/${idFactura}/nota-credito`, body);
  }

  notasDeFactura(idFactura: string): Observable<NotaCreditoElectronica[]> {
    return this.http.get<NotaCreditoElectronica[]>(`${this.base}/${idFactura}/notas-credito`);
  }

  /** Abre representación HTML para imprimir o guardar como PDF (Ctrl+P). */
  abrirHtmlFactura(id: string, onError?: (msg: string) => void): void {
    this.abrirHtml(`${this.base}/${id}/html`, onError);
  }

  abrirHtmlNotaCredito(notaId: string, onError?: (msg: string) => void): void {
    this.abrirHtml(`${this.base}/notas-credito/${notaId}/html`, onError);
  }

  /** PDF Factus/DIAN si existe; si no, HTML local. */
  verFactura(f: FacturaElectronicaItem, onError?: (msg: string) => void): void {
    const pdf = String(f.urlPdf || '').trim();
    if (pdf) {
      window.open(pdf, '_blank', 'noopener');
      return;
    }
    this.abrirHtmlFactura(f._id, onError);
  }

  verNotaCredito(n: NotaCreditoElectronica, onError?: (msg: string) => void): void {
    const pdf = String(n.urlPdf || '').trim();
    if (pdf) {
      window.open(pdf, '_blank', 'noopener');
      return;
    }
    this.abrirHtmlNotaCredito(n._id, onError);
  }

  private abrirHtml(url: string, onError?: (msg: string) => void): void {
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) {
      onError?.('El navegador bloqueó la ventana. Permita ventanas emergentes para este sitio.');
      return;
    }
    try {
      w.document.open();
      w.document.write('<p style="font-family:sans-serif;padding:1rem">Cargando documento…</p>');
      w.document.close();
    } catch {
      /* ventana en blanco */
    }

    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (html) => {
        try {
          w.document.open();
          w.document.write(html);
          w.document.close();
        } catch {
          w.close();
          onError?.('No se pudo mostrar el documento en la ventana.');
        }
      },
      error: (e) => {
        try {
          w.close();
        } catch {
          /* ignore */
        }
        onError?.(e?.error?.message || 'No se pudo generar el documento');
      },
    });
  }
}
