import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'argo-rrhh-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './rrhh-layout.component.html',
  styleUrls: ['./rrhh-layout.component.scss', './rrhh-shared.scss'],
})
export class RrhhLayoutComponent {}
