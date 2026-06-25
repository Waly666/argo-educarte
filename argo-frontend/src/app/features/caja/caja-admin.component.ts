import { CommonModule, CurrencyPipe } from '@angular/common';

import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { RouterLink } from '@angular/router';



import { CajaAbiertaItem, CajaSesionService } from '../../core/services/caja-sesion.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';



interface CierrePendiente {

  idSesion: number;

  usuario?: string;

  efectivoEsperado: number;

  efectivoContado: number | null;

}



@Component({

  selector: 'argo-caja-admin',

  standalone: true,

  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe],

  templateUrl: './caja-admin.component.html',

  styleUrls: ['./caja-cuadre.component.scss', './caja-layout.component.scss'],

})

export class CajaAdminComponent implements OnInit {

  private cajaSvc = inject(CajaSesionService);
  private confirm = inject(ConfirmDialogService);

  cajasAbiertas = signal<CajaAbiertaItem[]>([]);

  cierresPendientes = signal<CierrePendiente[]>([]);

  mostrarCierreMultiple = signal(false);

  loading = signal(false);

  msg = signal<string | null>(null);
  msgError = signal(false);



  hayCajasAbiertas = computed(() => this.cajasAbiertas().length > 0);



  ngOnInit(): void {

    this.cargarAbiertas();

  }



  cargarAbiertas(): void {

    this.cajaSvc.listarAbiertas().subscribe({

      next: (r) => {

        this.cajasAbiertas.set(r || []);

        this.cierresPendientes.set(

          (r || []).map((item) => ({

            idSesion: item.sesion.idSesion,

            usuario: item.sesion.usuario,

            efectivoEsperado: item.resumenParcial.efectivoEsperado ?? item.resumenParcial.saldoTeorico ?? 0,

            efectivoContado: item.resumenParcial.efectivoEsperado ?? null,

          })),

        );

      },

    });

  }



  actualizarContado(idSesion: number, valor: string | number): void {

    const n = valor === '' || valor == null ? null : Number(valor);

    this.cierresPendientes.update((rows) =>

      rows.map((r) => (r.idSesion === idSesion ? { ...r, efectivoContado: n } : r)),

    );

  }



  abrirCierreMultiple(): void {

    if (!this.cajasAbiertas().length) {

      this.inform('No hay cajas abiertas para cerrar');

      return;

    }

    this.mostrarCierreMultiple.set(true);

  }



  async cerrarTodasLasCajas(): Promise<void> {

    const pendientes = this.cierresPendientes();

    for (const p of pendientes) {

      if (p.efectivoContado == null || !Number.isFinite(p.efectivoContado)) {

        this.inform(`Indique el efectivo contado para ${p.usuario || 'cajero'} (sesión #${p.idSesion})`);

        return;

      }

    }

    const ok = await this.confirm.open({
      title: 'Cerrar cajas',
      message: `¿Cerrar ${pendientes.length} caja(s)?`,
      confirmLabel: 'Cerrar cajas',
      variant: 'warn',
    });
    if (!ok) return;



    this.loading.set(true);

    this.inform(null);

    this.cajaSvc

      .cerrarMultiples({

        cierres: pendientes.map((p) => ({

          idSesion: p.idSesion,

          efectivoContado: p.efectivoContado!,

          observaciones: 'Cierre simultáneo administrador',

        })),

      })

      .subscribe({

        next: () => {

          this.loading.set(false);

          this.mostrarCierreMultiple.set(false);

          this.inform('Cajas cerradas. Puede generar el informe en Cierre general.');

          this.cargarAbiertas();

        },

        error: (e) => {

          this.loading.set(false);

          this.inform(e?.error?.message || 'No se pudieron cerrar todas las cajas');

        },

      });

  }



  async cerrarAjena(item: CajaAbiertaItem): Promise<void> {

    const id = item.sesion?.idSesion;

    if (!id) return;

    const esperado = item.resumenParcial.efectivoEsperado ?? item.resumenParcial.saldoTeorico ?? 0;

    const raw = await this.confirm.openPrompt({
      title: 'Efectivo contado',
      message: `Cierre de caja de ${item.sesion.usuario}. Esperado: ${esperado.toLocaleString('es-CO')} COP.`,
      inputLabel: 'Efectivo contado (COP)',
      inputType: 'number',
      defaultValue: String(Math.round(esperado)),
      confirmLabel: 'Continuar',
      variant: 'primary',
    });

    if (raw == null) return;

    const contado = Number(raw);

    if (!Number.isFinite(contado)) {

      this.inform('Valor de efectivo contado inválido');

      return;

    }

    const ok = await this.confirm.open({
      title: 'Cerrar caja',
      message: `¿Cerrar caja de ${item.sesion.usuario}?`,
      confirmLabel: 'Cerrar caja',
      variant: 'warn',
    });
    if (!ok) return;

    this.cajaSvc

      .cerrar(id, { efectivoContado: contado, observaciones: 'Cierre administrador' })

      .subscribe({

        next: () => {

          this.inform(`Caja #${id} cerrada`);

          this.cargarAbiertas();

        },

        error: (e) => this.inform(e?.error?.message || 'No se pudo cerrar la caja'),

      });

  }


  private inform(text: string | null, isErr?: boolean): void {
    this.msg.set(text);
    let err = !!isErr;
    if (!err && text) {
      const t = text.toLowerCase();
      err =
        t.includes('error') ||
        t.includes('no se') ||
        t.includes('inválid') ||
        t.includes('obligator') ||
        t.includes('indique') ||
        t.includes('seleccione') ||
        t.includes('ingrese') ||
        t.includes('solo puede') ||
        t.includes('adjunte') ||
        t.includes('verifique');
    }
    this.msgError.set(err);
  }

}
