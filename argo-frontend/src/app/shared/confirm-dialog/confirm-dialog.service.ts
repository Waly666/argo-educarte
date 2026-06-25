import { Injectable, signal } from '@angular/core';

import {
  ConfirmDialogState,
  ConfirmIcon,
  ConfirmOptions,
  ConfirmPromptOptions,
  ConfirmVariant,
} from './confirm-dialog.types';

const DEFAULT_LABELS: Record<ConfirmVariant, { confirm: string; cancel: string }> = {
  danger: { confirm: 'Sí, eliminar', cancel: 'Cancelar' },
  primary: { confirm: 'Aceptar', cancel: 'Cancelar' },
  success: { confirm: 'Confirmar', cancel: 'Cancelar' },
  warn: { confirm: 'Continuar', cancel: 'Cancelar' },
};

const DEFAULT_ICONS: Record<ConfirmVariant, ConfirmIcon> = {
  danger: 'delete',
  primary: 'info',
  success: 'check',
  warn: 'warning',
};

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly state = signal<ConfirmDialogState | null>(null);

  private resolverBool: ((value: boolean) => void) | null = null;
  private resolverPrompt: ((value: string | null) => void) | null = null;

  open(options: ConfirmOptions): Promise<boolean> {
    const variant = options.variant ?? 'primary';
    const defaults = DEFAULT_LABELS[variant];
    return new Promise<boolean>((resolve) => {
      this.resolverBool = resolve;
      this.resolverPrompt = null;
      this.state.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? defaults.confirm,
        cancelLabel: options.cancelLabel ?? defaults.cancel,
        variant,
        icon: options.icon ?? DEFAULT_ICONS[variant],
        hideCancel: options.hideCancel ?? false,
      });
    });
  }

  /** Diálogo con campo de texto o número (sustituye window.prompt). */
  openPrompt(options: ConfirmPromptOptions): Promise<string | null> {
    const variant = options.variant ?? 'primary';
    const defaults = DEFAULT_LABELS[variant];
    return new Promise<string | null>((resolve) => {
      this.resolverPrompt = resolve;
      this.resolverBool = null;
      this.state.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? defaults.confirm,
        cancelLabel: options.cancelLabel ?? defaults.cancel,
        variant,
        icon: options.icon ?? DEFAULT_ICONS[variant],
        hideCancel: false,
        input: {
          label: options.inputLabel ?? '',
          type: options.inputType ?? 'text',
          value: options.defaultValue ?? '',
        },
      });
    });
  }

  setInputValue(value: string): void {
    const s = this.state();
    if (!s?.input) return;
    this.state.set({ ...s, input: { ...s.input, value } });
  }

  confirm(): void {
    const s = this.state();
    if (s?.input) {
      this.finishPrompt(s.input.value);
      return;
    }
    this.finishBool(true);
  }

  cancel(): void {
    if (this.resolverPrompt) {
      this.finishPrompt(null);
      return;
    }
    this.finishBool(false);
  }

  private finishBool(value: boolean): void {
    this.state.set(null);
    const r = this.resolverBool;
    this.resolverBool = null;
    this.resolverPrompt = null;
    r?.(value);
  }

  private finishPrompt(value: string | null): void {
    this.state.set(null);
    const r = this.resolverPrompt;
    this.resolverBool = null;
    this.resolverPrompt = null;
    r?.(value);
  }
}
