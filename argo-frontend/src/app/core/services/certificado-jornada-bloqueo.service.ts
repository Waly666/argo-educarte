import { Injectable, inject } from '@angular/core';

import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { JornadaCapService } from './jornada-cap.service';

export interface CertificadoBloqueoInfo {
  _id?: string;
  codigoCert?: string;
}

@Injectable({ providedIn: 'root' })
export class CertificadoJornadaBloqueoService {
  private confirm = inject(ConfirmDialogService);
  private jornadaSvc = inject(JornadaCapService);

  async mostrarAlumnoCertificado(opts: {
    nombreAlumno: string;
    certificado?: CertificadoBloqueoInfo | null;
  }): Promise<void> {
    const nombre = opts.nombreAlumno?.trim() || 'El alumno';
    const cod = opts.certificado?.codigoCert?.trim();
    const codTxt = cod ? ` (${cod})` : '';
    const id = String(opts.certificado?._id || '');

    const imprimir = await this.confirm.open({
      title: 'Alumno ya certificado',
      message:
        `${nombre} ya completó la capacitación en este contrato${codTxt}. ` +
        'No es posible inscribirlo ni registrar asistencia de nuevo: solo se permite un certificado por alumno y contrato.',
      confirmLabel: id ? 'Imprimir certificado' : 'Entendido',
      cancelLabel: 'Cerrar',
      variant: 'warn',
      icon: 'print',
      hideCancel: !id,
    });

    if (imprimir && id) {
      this.imprimirCertificadoDirecto(id);
    }
  }

  imprimirCertificadoDirecto(id: string): void {
    const certId = String(id || '').trim();
    if (!certId) return;
    this.jornadaSvc.imprimirCertificadoJornada(certId, (msg) => {
      void this.confirm.open({
        title: 'Impresión',
        message: msg,
        variant: 'warn',
        hideCancel: true,
        confirmLabel: 'Entendido',
      });
    });
  }

  async mostrarDesdeError(errorBody: unknown, nombreAlumno = 'El alumno'): Promise<void> {
    const body = (errorBody || {}) as {
      certificado?: CertificadoBloqueoInfo;
    };
    await this.mostrarAlumnoCertificado({
      nombreAlumno,
      certificado: body.certificado || null,
    });
  }
}
