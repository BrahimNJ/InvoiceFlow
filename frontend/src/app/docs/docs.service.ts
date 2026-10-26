import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { DocsPage, DocsSection } from './docs.models';

/** Static files generated at build time and served with the app (same origin, no API involved). */
export const DOCS_BASE = '/docs';

@Injectable({ providedIn: 'root' })
export class DocsService {
  private readonly http = inject(HttpClient);

  /** Fetched once per visit: the navigation does not change while the app runs. */
  readonly sections$: Observable<DocsSection[]> = this.http
    .get<DocsSection[]>(`${DOCS_BASE}/index.json`)
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  page(slug: string): Observable<DocsPage> {
    return this.http.get<DocsPage>(`${DOCS_BASE}/${encodeURIComponent(slug)}.json`);
  }
}
