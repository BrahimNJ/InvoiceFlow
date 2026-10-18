import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, defer, finalize, map, of, shareReplay, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthResponse, LoginPayload, RegisterPayload, User } from './auth.models';

const AUTH_API = `${environment.apiUrl}/api/auth`;

export const AUTH_ENDPOINTS = {
  register: `${AUTH_API}/register`,
  login: `${AUTH_API}/login`,
  refresh: `${AUTH_API}/refresh`,
  logout: `${AUTH_API}/logout`,
  me: `${AUTH_API}/me`,
} as const;

/**
 * Not a secret: only remembers that this browser signed in, so visitors who never did
 * do not send a refresh request on every page load.
 */
export const SESSION_HINT_KEY = 'invoiceflow.has-session';

/**
 * Holds the signed-in user and the access token.
 * The access token lives in memory only (never in localStorage, where any injected script could read it);
 * after a page reload the session is restored from the HttpOnly refresh cookie.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private refreshInFlight: Observable<string> | null = null;
  private restored$: Observable<boolean> | null = null;

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  register(payload: RegisterPayload): Observable<User> {
    return this.http
      .post<AuthResponse>(AUTH_ENDPOINTS.register, payload)
      .pipe(map((response) => this.startSession(response)));
  }

  login(payload: LoginPayload): Observable<User> {
    return this.http
      .post<AuthResponse>(AUTH_ENDPOINTS.login, payload)
      .pipe(map((response) => this.startSession(response)));
  }

  /**
   * Gets a new access token from the refresh cookie. Concurrent callers share one request:
   * the refresh token is single-use, a second parallel refresh would be seen as a replay.
   */
  refresh(): Observable<string> {
    this.refreshInFlight ??= this.http.post<AuthResponse>(AUTH_ENDPOINTS.refresh, null).pipe(
      map((response) => {
        this.startSession(response);
        return response.accessToken;
      }),
      catchError((error: unknown) => {
        this.clearSession();
        return throwError(() => error);
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay(1),
    );
    return this.refreshInFlight;
  }

  /** Restores the session once per page load. Emits whether the user is signed in; never errors. */
  restoreSession(): Observable<boolean> {
    this.restored$ ??= defer(() =>
      this.hasSessionHint()
        ? this.refresh().pipe(
            map(() => true),
            catchError(() => of(false)),
          )
        : of(false),
    ).pipe(shareReplay(1));
    return this.restored$;
  }

  /** Revokes the session on the server; the local session is cleared even if the server is unreachable. */
  logout(): Observable<void> {
    return this.http.post<void>(AUTH_ENDPOINTS.logout, null).pipe(
      catchError(() => of(undefined)),
      map(() => this.clearSession()),
    );
  }

  /** The session could not be renewed: sign in again, then come back to the current page. */
  expireSession(): void {
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
  }

  private startSession(response: AuthResponse): User {
    this._accessToken.set(response.accessToken);
    this._user.set(response.user);
    this.setSessionHint(true);
    return response.user;
  }

  private clearSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
    this.setSessionHint(false);
  }

  // Storage can be unavailable (private mode, blocked site data): the hint is best effort.
  private hasSessionHint(): boolean {
    try {
      return localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
      return true;
    }
  }

  private setSessionHint(signedIn: boolean): void {
    try {
      if (signedIn) {
        localStorage.setItem(SESSION_HINT_KEY, '1');
      } else {
        localStorage.removeItem(SESSION_HINT_KEY);
      }
    } catch {
      // ignored, see hasSessionHint
    }
  }
}
