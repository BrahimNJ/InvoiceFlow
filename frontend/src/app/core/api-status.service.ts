import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, timeout } from 'rxjs';

import { environment } from '../../environments/environment';

export type ApiStatus = 'checking' | 'up' | 'down';

/** Reads the backend health endpoint. The free hosting plan can take ~1 min to wake up. */
@Injectable({ providedIn: 'root' })
export class ApiStatusService {
  private readonly http = inject(HttpClient);
  private readonly _status = signal<ApiStatus>('checking');

  readonly status = this._status.asReadonly();

  check(): void {
    this._status.set('checking');
    this.http
      .get<{ status: string }>(`${environment.apiUrl}/actuator/health`)
      .pipe(
        timeout(90_000),
        map((health) => (health.status === 'UP' ? 'up' : 'down') as ApiStatus),
        catchError(() => of<ApiStatus>('down')),
      )
      .subscribe((status) => this._status.set(status));
  }
}
