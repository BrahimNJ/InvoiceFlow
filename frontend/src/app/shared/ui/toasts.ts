import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Icon } from '../icon/icon';
import { ToastService } from './toast.service';

/** Live region for `ToastService` messages: bottom of the screen on phones, bottom right otherwise. */
@Component({
  selector: 'app-toasts',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class.error]="toast.tone === 'error'">
          <app-icon [name]="toast.tone === 'error' ? 'alert' : 'check-circle'" [size]="20" />
          <p>{{ toast.message }}</p>
          <button class="close" type="button" aria-label="Dismiss notification" (click)="toasts.dismiss(toast.id)">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack { position: fixed; z-index: 100; right: 16px; bottom: 16px; left: 16px; display: grid; gap: .6rem;
             justify-items: end; pointer-events: none; }
    @media (min-width: 560px) { .stack { left: auto; width: 380px; right: 24px; bottom: 24px; } }
    .toast { display: flex; align-items: flex-start; gap: .7rem; width: 100%; padding: .85rem .9rem .85rem 1rem;
             border-radius: var(--radius); background: var(--night); color: var(--on-night); box-shadow: var(--shadow-lg);
             pointer-events: auto; animation: slide-in .35s var(--ease-out) both; }
    @keyframes slide-in { from { opacity: 0; transform: translateY(12px) scale(.98); } }
    .toast > app-icon { margin-top: .1rem; color: color-mix(in srgb, var(--accent) 60%, var(--on-night)); }
    .toast.error > app-icon { color: color-mix(in srgb, var(--danger) 45%, var(--on-night)); }
    p { flex: 1; font-size: .925rem; font-weight: 500; }
    .close { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: var(--radius);
             background: transparent; color: var(--on-night-muted); cursor: pointer; }
    .close:hover { background: var(--on-night-line); color: var(--on-night); }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
