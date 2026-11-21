import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { Company, CompanyPayload } from './company.models';

export const COMPANY_API = `${environment.apiUrl}/api/company`;

/** The company of the signed-in user (one per account): the seller printed on every invoice. */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);

  /** `null` until the first save (the API answers 404). */
  get(): Observable<Company | null> {
    return this.http.get<Company>(COMPANY_API).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error),
      ),
    );
  }

  save(payload: CompanyPayload): Observable<Company> {
    return this.http.put<Company>(COMPANY_API, payload);
  }
}
