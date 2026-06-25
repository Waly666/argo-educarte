import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  ViewChild,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

import {
  ArgoDateView,
  DIAS_CORTO,
  MESES_CORTO,
  MESES_LARGO,
  YEARS_PER_PAGE,
  buildMonthGrid,
  formatYmdDisplay,
  isYmdInRange,
  parseYmd,
  yearPageStart,
  yearsOnPage,
  ymdFromParts,
  ymdToday,
} from './argo-date.helpers';

@Component({
  selector: 'argo-date-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './argo-date-input.component.html',
  styleUrl: './argo-date-input.component.scss',
  host: {
    '[class.dropdown-open]': 'open',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ArgoDateInputComponent),
      multi: true,
    },
  ],
})
export class ArgoDateInputComponent implements ControlValueAccessor {
  private host = inject(ElementRef<HTMLElement>);

  @Input() label = '';
  @Input() placeholder = 'DD/MM/AAAA';
  @Input() inputId = '';
  @Input() min: string | null = null;
  @Input() max: string | null = null;
  @Input() disabled = false;

  @ViewChild('textInput') textInput?: ElementRef<HTMLInputElement>;

  readonly diasCorto = DIAS_CORTO;
  readonly mesesCorto = MESES_CORTO;

  open = false;
  view: ArgoDateView = 'day';
  /** YYYY-MM-DD interno */
  value = '';
  /** Texto visible en el input */
  displayText = '';
  /** Navegación del panel */
  panelYear = new Date().getFullYear();
  panelMonth = new Date().getMonth();
  yearPage = yearPageStart(new Date().getFullYear());

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value = v ? String(v).slice(0, 10) : '';
    this.displayText = formatYmdDisplay(this.value);
    const d = parseYmd(this.value) || new Date();
    this.panelYear = d.getFullYear();
    this.panelMonth = d.getMonth();
    this.yearPage = yearPageStart(this.panelYear);
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  get panelTitle(): string {
    if (this.view === 'year') {
      const end = this.yearPage + YEARS_PER_PAGE - 1;
      return `${this.yearPage} – ${end}`;
    }
    if (this.view === 'month') {
      return String(this.panelYear);
    }
    return `${MESES_LARGO[this.panelMonth]} ${this.panelYear}`;
  }

  get yearCells(): number[] {
    return yearsOnPage(this.yearPage);
  }

  get monthGrid(): (number | null)[][] {
    return buildMonthGrid(this.panelYear, this.panelMonth);
  }

  /** Celdas del mes en una sola lista (7 columnas) con clave estable para @for. */
  get monthDayCells(): { key: string; day: number | null }[] {
    const prefix = `${this.panelYear}-${this.panelMonth}`;
    return this.monthGrid.flatMap((row, rowIndex) =>
      row.map((day, colIndex) => ({
        key: `${prefix}-${rowIndex}-${colIndex}`,
        day,
      })),
    );
  }

  get selectedParts(): { y: number; m: number; d: number } | null {
    const p = parseYmd(this.value);
    if (!p) return null;
    return { y: p.getFullYear(), m: p.getMonth(), d: p.getDate() };
  }

  toggleOpen(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      const d = parseYmd(this.value) || new Date();
      this.panelYear = d.getFullYear();
      this.panelMonth = d.getMonth();
      this.yearPage = yearPageStart(this.panelYear);
      this.view = 'day';
    } else {
      this.onTouched();
    }
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.view = 'day';
    this.onTouched();
  }

  onTextInput(raw: string): void {
    this.displayText = raw;
  }

  onTextBlur(): void {
    const trimmed = this.displayText.trim();
    if (!trimmed) {
      this.commitValue('');
      return;
    }
    const d = parseYmd(trimmed);
    if (!d) {
      this.displayText = formatYmdDisplay(this.value);
      return;
    }
    const ymd = ymdFromParts(d);
    if (!isYmdInRange(ymd, this.min, this.max)) {
      this.displayText = formatYmdDisplay(this.value);
      return;
    }
    this.commitValue(ymd);
  }

  onTextEnter(ev: Event): void {
    ev.preventDefault();
    this.onTextBlur();
    this.textInput?.nativeElement.blur();
  }

  goPrev(): void {
    if (this.view === 'year') {
      this.yearPage -= YEARS_PER_PAGE;
      return;
    }
    if (this.view === 'month') {
      this.panelYear -= 1;
      this.yearPage = yearPageStart(this.panelYear);
      return;
    }
    if (this.panelMonth === 0) {
      this.panelMonth = 11;
      this.panelYear -= 1;
    } else {
      this.panelMonth -= 1;
    }
  }

  goNext(): void {
    if (this.view === 'year') {
      this.yearPage += YEARS_PER_PAGE;
      return;
    }
    if (this.view === 'month') {
      this.panelYear += 1;
      this.yearPage = yearPageStart(this.panelYear);
      return;
    }
    if (this.panelMonth === 11) {
      this.panelMonth = 0;
      this.panelYear += 1;
    } else {
      this.panelMonth += 1;
    }
  }

  showYearView(): void {
    this.yearPage = yearPageStart(this.panelYear);
    this.view = 'year';
  }

  showMonthView(): void {
    this.view = 'month';
  }

  showDayView(): void {
    this.view = 'day';
  }

  pickYear(y: number): void {
    this.panelYear = y;
    this.view = 'month';
  }

  pickMonth(m: number): void {
    this.panelMonth = m;
    this.view = 'day';
  }

  pickDay(day: number): void {
    const ymd = ymdFromParts(new Date(this.panelYear, this.panelMonth, day));
    if (!isYmdInRange(ymd, this.min, this.max)) return;
    this.commitValue(ymd);
    this.close();
  }

  pickToday(): void {
    const t = ymdToday();
    if (!isYmdInRange(t, this.min, this.max)) return;
    this.commitValue(t);
    const d = parseYmd(t)!;
    this.panelYear = d.getFullYear();
    this.panelMonth = d.getMonth();
    this.close();
  }

  clear(): void {
    this.commitValue('');
    this.close();
  }

  isDayDisabled(day: number): boolean {
    const ymd = ymdFromParts(new Date(this.panelYear, this.panelMonth, day));
    return !isYmdInRange(ymd, this.min, this.max);
  }

  isYearSelected(y: number): boolean {
    const s = this.selectedParts;
    return !!s && s.y === y;
  }

  isYearCurrent(y: number): boolean {
    return y === new Date().getFullYear();
  }

  isMonthSelected(m: number): boolean {
    const s = this.selectedParts;
    return !!s && s.y === this.panelYear && s.m === m;
  }

  isDaySelected(day: number): boolean {
    const s = this.selectedParts;
    return !!s && s.y === this.panelYear && s.m === this.panelMonth && s.d === day;
  }

  isToday(day: number): boolean {
    const t = parseYmd(ymdToday());
    if (!t) return false;
    return (
      t.getFullYear() === this.panelYear
      && t.getMonth() === this.panelMonth
      && t.getDate() === day
    );
  }

  private commitValue(ymd: string): void {
    this.value = ymd;
    this.displayText = formatYmdDisplay(ymd);
    this.onChange(ymd);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open) return;
    const el = this.host.nativeElement;
    if (el.contains(ev.target as Node)) return;
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
