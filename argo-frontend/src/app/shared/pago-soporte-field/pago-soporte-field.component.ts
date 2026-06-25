import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'argo-pago-soporte-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pago-soporte-field.component.html',
  styleUrl: './pago-soporte-field.component.scss',
})
export class PagoSoporteFieldComponent {
  @Input() obligatorio = true;
  @Input() previewUrl: string | null = null;
  @Input() nombreArchivo: string | null = null;
  @Input() hint =
    'Suba la captura del voucher: transferencia, tarjeta, Nequi, Daviplata, cheque, etc.';

  @Output() seleccionado = new EventEmitter<File>();
  @Output() quitado = new EventEmitter<void>();

  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.seleccionado.emit(file);
  }

  onQuitar(input: HTMLInputElement) {
    input.value = '';
    this.quitado.emit();
  }
}
