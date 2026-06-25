import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { SupervisorAuthComponent } from './shared/supervisor-auth/supervisor-auth.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent, SupervisorAuthComponent],
  template: `
    <router-outlet></router-outlet>
    <argo-confirm-dialog />
    <argo-supervisor-auth />
  `,
  styles: [':host { display: block; min-height: 100vh; }'],
})
export class AppComponent {}
