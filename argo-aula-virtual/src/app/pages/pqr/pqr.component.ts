import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { AulaApiService } from '../../core/aula-api.service';
import { PqrFormComponent } from '../../shared/pqr-form/pqr-form.component';

@Component({
  selector: 'av-pqr',
  standalone: true,
  imports: [CommonModule, RouterLink, PqrFormComponent],
  templateUrl: './pqr.component.html',
  styleUrl: './pqr.component.scss',
})
export class PqrComponent implements OnInit {
  private api = inject(AulaApiService);
  private titleSvc = inject(Title);

  nombreCea = signal('');

  ngOnInit() {
    this.api.config().subscribe({
      next: (c) => {
        const cea = c.nombreCea || 'Aula Virtual';
        this.nombreCea.set(cea);
        this.titleSvc.setTitle(`PQR — ${cea}`);
      },
    });
  }
}
