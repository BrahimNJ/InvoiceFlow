import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AUTH_ENDPOINTS, AuthService } from './auth.service';

const API_PREFIX = `${environment.apiUrl}/api/`;

/** Endpoints that work with the refresh cookie instead of a bearer token. */
const COOKIE_ENDPOINTS: readonly string[] = [
  AUTH_ENDPOINTS.register,
  AUTH_ENDPOINTS.login,
  AUTH_ENDPOINTS.refresh,
  AUTH_ENDPOINTS.logout,
];

/** Required by the backend on cookie endpoints: forces a CORS preflight, which blocks cross-site forgery. */
export const CSRF_HEADER = 'X-Requested-With';

/**
 * - Cookie endpoints: send the cookie cross-origin (withCredentials) and the anti-CSRF header.
 * - Other API calls: add the bearer token; on 401, refresh once and retry, or end the session.
 * - Anything else (other origins, /actuator/health): untouched, the token never leaves for another host.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_PREFIX)) {
    return next(request);
  }
  if (COOKIE_ENDPOINTS.includes(request.url)) {
    return next(request.clone({ withCredentials: true, setHeaders: { [CSRF_HEADER]: 'XMLHttpRequest' } }));
  }

  const auth = inject(AuthService);
  return next(withBearer(request, auth.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError(() => {
          auth.expireSession();
          return throwError(() => error);
        }),
        // Retried once, outside this interceptor: a second 401 is returned as is, no loop
        switchMap((token) => next(withBearer(request, token))),
      );
    }),
  );
};

function withBearer(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}
