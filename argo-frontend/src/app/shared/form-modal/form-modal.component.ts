import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';

@Component({
  selector: 'argo-form-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-modal.component.html',
  styleUrls: ['./form-modal.component.scss'],
})
export class FormModalComponent implements OnChanges, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private originalParent: HTMLElement | null = null;
  private originalNextSibling: ChildNode | null = null;

  @Input({ required: true }) open = false;
  @Input({ required: true }) title = '';
  @Input() wide = false;
  /** Modal ancho completo (~1280px) para formularios densos. */
  @Input() xwide = false;
  /** Formulario alto: ancla arriba y usa casi toda la altura del viewport. */
  @Input() tall = false;
  @Input() subtitle = '';
  /** Distancia desde arriba del viewport (px). Si no se pasa, se usa el valor por defecto del CSS. */
  @Input() anchorTopPx: number | null = null;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panelRef?: ElementRef<HTMLElement>;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['open']) {
      if (this.open) this.attachToBody();
      else this.restoreParent();
    }
    if (changes['open']?.currentValue || changes['anchorTopPx'] || changes['tall']) {
      setTimeout(() => this.syncPanelMaxHeight());
    }
  }

  ngOnDestroy() {
    this.restoreParent();
  }

  /** Evita que backdrop-filter/transform de .card desplace position:fixed del modal. */
  private attachToBody() {
    const host = this.el.nativeElement;
    if (host.parentElement === document.body) return;
    this.originalParent = host.parentElement;
    this.originalNextSibling = host.nextSibling;
    document.body.appendChild(host);
  }

  private restoreParent() {
    const host = this.el.nativeElement;
    if (!this.originalParent || host.parentElement !== document.body) return;
    if (this.originalNextSibling && this.originalNextSibling.parentElement === this.originalParent) {
      this.originalParent.insertBefore(host, this.originalNextSibling);
    } else {
      this.originalParent.appendChild(host);
    }
    this.originalParent = null;
    this.originalNextSibling = null;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open) this.close();
  }

  @HostListener('window:resize')
  onResize() {
    this.syncPanelMaxHeight();
  }

  close() {
    this.closed.emit();
  }

  layerTopPx(): number {
    if (this.anchorTopPx != null) return this.anchorTopPx;
    if (this.tall) return 36;
    return 168;
  }

  /** Recalcula altura máxima del panel según espacio disponible bajo el ancla. */
  syncPanelMaxHeight() {
    if (!this.open || !this.panelRef) return;
    const top = this.layerTopPx();
    const bottom = this.tall ? 12 : 16;
    const maxH = Math.max(240, window.innerHeight - top - bottom);
    this.panelRef.nativeElement.style.maxHeight = `${maxH}px`;
  }
}
