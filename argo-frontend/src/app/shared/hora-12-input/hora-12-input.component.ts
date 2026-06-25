import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DEFAULT_HORA_INICIO_HHMM,
  HORAS_12,
  type AmPm,
  hhmmTo12Parts,
  parts12ToHhmm,
} from '../../core/utils/hora-12.util';

@Component({
  selector: 'argo-hora-12-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hora-12-input.component.html',
  styleUrl: './hora-12-input.component.scss',
})
export class Hora12InputComponent implements OnInit, OnChanges {
  @Input({ required: true }) value = '';
  /** Intervalo de minutos en el selector (15 = más simple). Si el valor actual no cae en el intervalo, se incluye igual. */
  @Input() minuteStep = 1;
  @Input() showPreview = true;
  /** HH:mm usado cuando value está vacío (visual y, si syncDefaultWhenEmpty, en el modelo padre). */
  @Input() defaultWhenEmpty = DEFAULT_HORA_INICIO_HHMM;
  /** Emite defaultWhenEmpty al padre si value llega vacío (evita guardar sin hora aunque el UI muestre 8:00). */
  @Input() syncDefaultWhenEmpty = true;
  @Output() valueChange = new EventEmitter<string>();

  readonly horas12 = HORAS_12;

  get minutosOptions(): number[] {
    const step = Math.max(1, Math.min(30, Number(this.minuteStep) || 1));
    const base: number[] = [];
    for (let m = 0; m < 60; m += step) base.push(m);
    const cur = this.minute;
    if (!base.includes(cur)) return [...base, cur].sort((a, b) => a - b);
    return base;
  }

  get hour12(): number {
    return hhmmTo12Parts(this.displayValue).hour12;
  }

  get minute(): number {
    return hhmmTo12Parts(this.displayValue).minute;
  }

  get ampm(): AmPm {
    return hhmmTo12Parts(this.displayValue).ampm;
  }

  get previewLabel(): string {
    const { hour12, minute, ampm } = hhmmTo12Parts(this.displayValue);
    const suf = ampm === 'PM' ? 'p. m.' : 'a. m.';
    const min = String(minute).padStart(2, '0');
    return min === '00' ? `${hour12} ${suf}` : `${hour12}:${min} ${suf}`;
  }

  ngOnInit(): void {
    this.syncDefaultToParentIfNeeded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] || changes['defaultWhenEmpty'] || changes['syncDefaultWhenEmpty']) {
      this.syncDefaultToParentIfNeeded();
    }
  }

  onHourChange(raw: string | number) {
    this.emit(+raw, this.minute, this.ampm);
  }

  onMinuteChange(raw: string | number) {
    this.emit(this.hour12, +raw, this.ampm);
  }

  setAmPm(next: AmPm) {
    if (next === this.ampm) return;
    this.emit(this.hour12, this.minute, next);
  }

  fmtMin(m: number): string {
    return String(m).padStart(2, '0');
  }

  private get displayValue(): string {
    const v = String(this.value ?? '').trim();
    if (v) return v;
    return String(this.defaultWhenEmpty ?? DEFAULT_HORA_INICIO_HHMM).trim();
  }

  private syncDefaultToParentIfNeeded(): void {
    if (!this.syncDefaultWhenEmpty) return;
    const v = String(this.value ?? '').trim();
    if (v) return;
    const d = String(this.defaultWhenEmpty ?? '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(d)) return;
    queueMicrotask(() => {
      if (!String(this.value ?? '').trim()) {
        this.valueChange.emit(d);
      }
    });
  }

  private emit(hour12: number, minute: number, ampm: AmPm) {
    this.valueChange.emit(parts12ToHhmm(hour12, minute, ampm));
  }
}
