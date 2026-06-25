export type ConfirmVariant = 'danger' | 'primary' | 'success' | 'warn';

export type ConfirmIcon = 'delete' | 'warning' | 'info' | 'check' | 'print';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  icon?: ConfirmIcon;
  /** Solo botón de confirmación (avisos informativos) */
  hideCancel?: boolean;
}

export interface ConfirmPromptOptions extends ConfirmOptions {
  inputLabel?: string;
  inputType?: 'text' | 'number';
  defaultValue?: string;
}

export interface ConfirmDialogInput {
  label: string;
  type: 'text' | 'number';
  value: string;
}

export interface ConfirmDialogState extends Required<Pick<ConfirmOptions, 'title' | 'message'>> {
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  icon: ConfirmIcon;
  hideCancel: boolean;
  input?: ConfirmDialogInput;
}
