import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';

import { SupervisorAuthService } from './supervisor-auth.service';

@Component({
  selector: 'argo-supervisor-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supervisor-auth.component.html',
  styleUrls: ['./supervisor-auth.component.scss'],
  animations: [
    trigger('backdropAnim', [
      transition(':enter', [style({ opacity: 0 }), animate('160ms ease-out', style({ opacity: 1 }))]),
      transition(':leave', [animate('120ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('dialogAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translate(-50%, -48%) scale(0.94)' }),
        animate(
          '200ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translate(-50%, -48%) scale(0.96)' })),
      ]),
    ]),
  ],
})
export class SupervisorAuthComponent {
  svc = inject(SupervisorAuthService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.svc.state()) this.svc.cancel();
  }
}
