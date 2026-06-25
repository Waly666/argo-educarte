import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'argo-switch',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './argo-switch.component.html',
  styleUrl: './argo-switch.component.scss',
})
export class ArgoSwitchComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() label = '';

  @Output() checkedChange = new EventEmitter<boolean>();

  onInput(ev: Event) {
    const on = (ev.target as HTMLInputElement).checked;
    this.checkedChange.emit(on);
  }
}
