import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'argo-backup-reset-restore-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sys-subnav" aria-label="Backup, reset, restore y migración">
      <a routerLink="/app/configuracion/backup" routerLinkActive="active">Backup</a>
      <a routerLink="/app/configuracion/restore" routerLinkActive="active">Restore</a>
      <a routerLink="/app/configuracion/reset" routerLinkActive="active">Reset</a>
      <a routerLink="/app/configuracion/limpieza-tablas" routerLinkActive="active">Limpieza tablas</a>
      <a routerLink="/app/configuracion/migracion" routerLinkActive="active">Migración</a>
    </nav>
  `,
  styleUrls: ['./backup-reset-restore-nav.component.scss'],
})
export class BackupResetRestoreNavComponent {}
