import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

/** Long enough to read two lines; the user can also close a toast. */
export const TOAST_DURATION_MS = 5000;

/** Short confirmations shown in a corner of the screen (rendered once by `Toasts` in the app shell). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  private nextId = 0;

  readonly toasts = this.items.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  dismiss(id: number): void {
    this.items.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(tone: ToastTone, message: string): void {
    const id = this.nextId++;
    // At most 3 on screen: the oldest goes first
    this.items.update((toasts) => [...toasts.slice(-2), { id, tone, message }]);
    setTimeout(() => this.dismiss(id), TOAST_DURATION_MS);
  }
}
