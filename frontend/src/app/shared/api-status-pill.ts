import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ApiStatusService } from '../core/api-status.service';

const LABELS = {
  checking: 'Connecting to the API…',
  up: 'API online',
  down: 'API unavailable',
} as const;

@Component({
  selector: 'app-api-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="dot"></span>{{ label() }}`,
  host: { role: 'status', '[class]': 'status()' },
  styles: `
    :host { display: inline-flex; align-items: center; gap: .5rem; padding: .3rem .75rem;
            border-radius: 999px; font-size: .8rem; font-weight: 500;
            background: rgb(255 255 255 / .08); border: 1px solid rgb(255 255 255 / .14); }
    .dot { width: .5rem; height: .5rem; border-radius: 50%; background: #f5b83d; }
    :host(.checking) .dot { animation: pulse 1.4s ease-in-out infinite; }
    :host(.up) .dot { background: #22c993; box-shadow: 0 0 0 3px rgb(34 201 147 / .25); }
    :host(.down) .dot { background: #f2555a; }
    @keyframes pulse { 50% { opacity: .3; } }
  `,
})
export class ApiStatusPill {
  protected readonly status = inject(ApiStatusService).status;
  protected readonly label = computed(() => LABELS[this.status()]);
}
