import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authResponse, TEST_USER } from './auth.fixtures';
import { User } from './auth.models';
import { AUTH_ENDPOINTS, AuthService, SESSION_HINT_KEY } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts signed out', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
  });

  it('signs in and keeps the access token in memory only', () => {
    let user: User | undefined;
    service.login({ email: 'jane@acme.fr', password: 'Correct-horse-42' }).subscribe((u) => (user = u));

    const request = http.expectOne(AUTH_ENDPOINTS.login);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'jane@acme.fr', password: 'Correct-horse-42' });
    request.flush(authResponse());

    expect(user).toEqual(TEST_USER);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('access-1');
    expect(JSON.stringify({ ...localStorage })).not.toContain('access-1');
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
  });

  it('registers and signs in right away', () => {
    service
      .register({ firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.fr', password: 'Correct-horse-42' })
      .subscribe();

    http.expectOne(AUTH_ENDPOINTS.register).flush(authResponse(), { status: 201, statusText: 'Created' });

    expect(service.user()).toEqual(TEST_USER);
  });

  it('shares one refresh request between concurrent callers', () => {
    const tokens: string[] = [];
    service.refresh().subscribe((token) => tokens.push(token));
    service.refresh().subscribe((token) => tokens.push(token));

    http.expectOne(AUTH_ENDPOINTS.refresh).flush(authResponse('access-2'));

    expect(tokens).toEqual(['access-2', 'access-2']);
    expect(service.accessToken()).toBe('access-2');

    // The next refresh is a new request
    service.refresh().subscribe();
    http.expectOne(AUTH_ENDPOINTS.refresh).flush(authResponse('access-3'));
    expect(service.accessToken()).toBe('access-3');
  });

  it('clears the session when the refresh is rejected', () => {
    signIn();
    let failed = false;

    service.refresh().subscribe({ error: () => (failed = true) });
    http.expectOne(AUTH_ENDPOINTS.refresh).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
  });

  it('does not call the API to restore a session this browser never had', () => {
    let restored: boolean | undefined;
    service.restoreSession().subscribe((value) => (restored = value));

    http.expectNone(AUTH_ENDPOINTS.refresh);
    expect(restored).toBe(false);
  });

  it('restores the session from the refresh cookie once per page load', () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    const results: boolean[] = [];

    service.restoreSession().subscribe((value) => results.push(value));
    http.expectOne(AUTH_ENDPOINTS.refresh).flush(authResponse());
    service.restoreSession().subscribe((value) => results.push(value));

    expect(results).toEqual([true, true]);
    expect(service.user()).toEqual(TEST_USER);
  });

  it('reports a failed restore without erroring', () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    let restored: boolean | undefined;

    service.restoreSession().subscribe((value) => (restored = value));
    http.expectOne(AUTH_ENDPOINTS.refresh).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(restored).toBe(false);
  });

  it('signs out locally even when the server cannot be reached', () => {
    signIn();
    let done = false;

    service.logout().subscribe(() => (done = true));
    http.expectOne(AUTH_ENDPOINTS.logout).error(new ProgressEvent('error'));

    expect(done).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('sends the user to the sign-in page when the session expires', () => {
    signIn();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    service.expireSession();

    expect(service.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });

  function signIn(): void {
    service.login({ email: 'jane@acme.fr', password: 'Correct-horse-42' }).subscribe();
    http.expectOne(AUTH_ENDPOINTS.login).flush(authResponse());
  }
});
