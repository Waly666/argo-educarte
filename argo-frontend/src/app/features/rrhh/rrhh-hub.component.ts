import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'argo-rrhh-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rrhh-hub.component.html',
  styleUrls: ['./rrhh-hub.component.scss', './rrhh-shared.scss'],
})
export class RrhhHubComponent {}
