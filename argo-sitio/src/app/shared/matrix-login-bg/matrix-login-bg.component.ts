import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';

/** Matriz estilo login ARGO — solo para el hero promocional. */
@Component({
  selector: 'argo-matrix-login-bg',
  standalone: true,
  template: `<canvas #canvas class="matrix-login-bg__canvas" aria-hidden="true"></canvas>`,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .matrix-login-bg__canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class MatrixLoginBgComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private rafId: number | null = null;
  private resizeObserver?: ResizeObserver;
  private drops: number[] = [];
  private readonly fontSize = 14;
  private readonly chars =
    'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎ0123456789ARGO';

  ngAfterViewInit(): void {
    const parent = this.canvasRef.nativeElement.parentElement;
    if (!parent) return;

    this.resizeCanvas();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(parent);
    this.startMatrix();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const cols = Math.max(1, Math.floor(w / this.fontSize));
    this.drops = new Array(cols).fill(0).map(() => Math.floor(Math.random() * -40));
  }

  private startMatrix(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fs = this.fontSize;

    const draw = () => {
      this.rafId = requestAnimationFrame(draw);
      const dpr = canvas.width / (canvas.clientWidth || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(15, 39, 68, 0.14)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fs}px "Exo", ui-monospace, monospace`;
      ctx.textBaseline = 'top';

      for (let i = 0; i < this.drops.length; i++) {
        const text = this.chars.charAt(Math.floor(Math.random() * this.chars.length));
        const x = i * fs;
        const y = this.drops[i] * fs;

        const grad = ctx.createLinearGradient(x, y - fs * 5, x, y);
        grad.addColorStop(0, 'rgba(78, 163, 255, 0.04)');
        grad.addColorStop(0.6, 'rgba(78, 163, 255, 0.35)');
        grad.addColorStop(1, 'rgba(123, 208, 255, 0.88)');
        ctx.fillStyle = grad;
        ctx.fillText(text, x, y);

        if (y > h + fs && Math.random() > 0.975) this.drops[i] = 0;
        this.drops[i] += 0.45;
      }
    };

    draw();
  }
}
