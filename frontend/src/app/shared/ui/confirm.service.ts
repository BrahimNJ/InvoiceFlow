import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  /** `danger` for destructive actions (red button). */
  tone?: 'danger' | 'primary';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Asks the user to confirm an action in an accessible dialog (rendered once by `ConfirmDialog` in the app shell),
 * instead of the browser `confirm()` that cannot be styled.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly pending = signal<PendingConfirm | null>(null);

  /** The question on screen, if any. */
  readonly current = this.pending.asReadonly();

  /** Resolves to true when the user confirms, false when they cancel. A new question cancels the previous one. */
  ask(options: ConfirmOptions): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  answer(confirmed: boolean): void {
    const pending = this.pending();
    this.pending.set(null);
    pending?.resolve(confirmed);
  }
}
