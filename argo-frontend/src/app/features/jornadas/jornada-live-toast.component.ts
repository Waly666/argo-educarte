import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { JornadaLiveSyncService } from '../../core/services/jornada-live-sync.service';

@Component({
  selector: 'argo-jornada-live-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './jornada-live-toast.component.html',
  styleUrls: ['./jornada-live-toast.component.scss'],
})
export class JornadaLiveToastComponent {
  private liveSync = inject(JornadaLiveSyncService);

  toast = this.liveSync.toast;
}
