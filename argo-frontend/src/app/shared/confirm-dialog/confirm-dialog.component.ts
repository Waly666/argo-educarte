import { Component, HostListener, inject } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';

import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'argo-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  animations: [
    trigger('backdropAnim', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('180ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('140ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('dialogAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translate(-50%, -48%) scale(0.94)' }),
        animate(
          '220ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '160ms ease-in',
          style({ opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' }),
        ),
      ]),
    ]),
  ],
})
export class ConfirmDialogComponent {
  svc = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.svc.state()) this.svc.cancel();
  }
}
