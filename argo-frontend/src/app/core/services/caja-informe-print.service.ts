import { Injectable, inject } from '@angular/core';

import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { ConfigRecibo, ConfigService } from './config.service';
import {
  buildInformeGeneralHtml,
  buildInformeIndividualHtml,
} from './caja-informe-document';
import {
  CajaDescuadre,
  CajaEgresoItem,
  CajaIngresoItem,
  CajaSesion,
  ResumenCaja,
  ResumenCierreGeneral,
} from './caja-sesion.service';

@Injectable({ providedIn: 'root' })
export class CajaInformePrintService {
  private configSvc = inject(ConfigService);
  private confirm = inject(ConfirmDialogService);
  private empresaCache = new Map<string, ConfigRecibo>();

  imprimirIndividual(opts: {
    sesion: CajaSesion;
    resumen: ResumenCaja;
    ingresos: CajaIngresoItem[];
    egresos: CajaEgresoItem[];
    descuadre?: CajaDescuadre | null;
    empresa?: ConfigRecibo | null;
  }): void {
    const idSede = opts.sesion.idSede || undefined;
    const run = (empresa: ConfigRecibo | null) => {
      const html = buildInformeIndividualHtml({ ...opts, empresa });
      this.abrirVentana(html, `Cuadre de caja #${opts.sesion.idSesion}`);
    };
    if (opts.empresa !== undefined) {
      run(opts.empresa);
      return;
    }
    this.obtenerEmpresa(idSede, run);
  }

  imprimirGeneral(general: ResumenCierreGeneral, empresa?: ConfigRecibo | null): void {
    const idSede = general.idSede || undefined;
    const run = (emp: ConfigRecibo | null) => {
      const html = buildInformeGeneralHtml({ general, empresa: emp });
      this.abrirVentana(html, 'Informe general de cierre de cajas');
    };
    if (empresa !== undefined) {
      run(empresa);
      return;
    }
    this.obtenerEmpresa(idSede, run);
  }

  private obtenerEmpresa(idSede: string | undefined, cb: (empresa: ConfigRecibo | null) => void): void {
    const key = idSede || '__activa__';
    const cached = this.empresaCache.get(key);
    if (cached) {
      cb(cached);
      return;
    }
    this.configSvc.obtenerReciboEncabezado(idSede).subscribe({
      next: (c) => {
        this.empresaCache.set(key, c);
        cb(c);
      },
      error: () => cb(null),
    });
  }

  private abrirVentana(html: string, titulo: string): void {
    const ventana = window.open('', '_blank', 'width=920,height=720,scrollbars=yes');
    if (!ventana) {
      void this.confirm.open({
        title: 'Ventana bloqueada',
        message: 'Permita ventanas emergentes en el navegador para ver el informe de caja.',
        confirmLabel: 'Entendido',
        variant: 'warn',
        hideCancel: true,
      });
      return;
    }
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
    ventana.document.title = titulo;
    ventana.focus();
    const imprimir = () => {
      try {
        ventana.focus();
        ventana.print();
      } catch {
        /* usuario puede usar botón Imprimir de la ventana */
      }
    };
    if (ventana.document.readyState === 'complete') {
      setTimeout(imprimir, 300);
    } else {
      ventana.onload = () => setTimeout(imprimir, 300);
    }
  }
}
