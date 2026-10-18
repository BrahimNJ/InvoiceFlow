import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { authResponse } from './auth.fixtures';
import { CSRF_HEADER, authInterceptor } from './auth.interceptor';
import { AUTH_ENDPOINTS, AuthService } from './auth.service';

const CUSTOMERS = `${environment.apiUrl}/api/customers`;

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  function signIn(token = 'access-1'): void {
    auth.login({ email: 'jane@acme.fr', password: 'Correct-horse-42' }).subscribe();
    backend.expectOne(AUTH_ENDPOINTS.login).flush(authResponse(token));
  }

  it('adds the bearer token to API calls', () => {
    signIn();

    http.get(CUSTOMERS).subscribe();

    expect(backend.expectOne(CUSTOMERS).request.headers.get('Authorization')).toBe('Bearer access-1');
  });

  it('never sends the token to another host nor to the health endpoint', () => {
    signIn();

    http.get('https://example.com/api/customers').subscribe();
    http.get(`${environment.apiUrl}/actuator/health`).subscribe();

    expect(backend.expectOne('https://example.com/api/customers').request.headers.has('Authorization')).toBe(false);
    expect(backend.expectOne(`${environment.apiUrl}/actuator/health`).request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('sends the cookie and the anti-CSRF header to the cookie endpoints, without a bearer token', () => {
    signIn();

    auth.refresh().subscribe();

    const refresh = backend.expectOne(AUTH_ENDPOINTS.refresh);
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.get(CSRF_HEADER)).toBe('XMLHttpRequest');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(authResponse());
  });

  it('refreshes the token once on 401 and retries the request', () => {
    signIn('expired');
    let body: unknown;

    http.get(CUSTOMERS).subscribe((response) => (body = response));
    backend.expectOne(CUSTOMERS).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(AUTH_ENDPOINTS.refresh).flush(authResponse('fresh'));
    const retry = backend.expectOne(CUSTOMERS);

    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh');
    retry.flush([{ id: 1 }]);
    expect(body).toEqual([{ id: 1 }]);
  });

  it('uses a single refresh for concurrent 401 responses', () => {
    signIn('expired');

    http.get(CUSTOMERS).subscribe();
    http.get(`${CUSTOMERS}/1`).subscribe();
    backend.expectOne(CUSTOMERS).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${CUSTOMERS}/1`).flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectOne(AUTH_ENDPOINTS.refresh).flush(authResponse('fresh'));
    backend.expectOne(CUSTOMERS).flush([]);
    backend.expectOne(`${CUSTOMERS}/1`).flush({});
  });

  it('ends the session when the refresh fails', () => {
    signIn('expired');
    const expire = vi.spyOn(auth, 'expireSession').mockImplementation(() => undefined);
    let error: HttpErrorResponse | undefined;

    http.get(CUSTOMERS).subscribe({ error: (e: HttpErrorResponse) => (error = e) });
    backend.expectOne(CUSTOMERS).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(AUTH_ENDPOINTS.refresh).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(expire).toHaveBeenCalled();
    expect(error?.status).toBe(401);
  });

  it('does not retry a request rejected again after the refresh', () => {
    signIn('expired');
    let status: number | undefined;

    http.get(CUSTOMERS).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });
    backend.expectOne(CUSTOMERS).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(AUTH_ENDPOINTS.refresh).flush(authResponse('fresh'));
    backend.expectOne(CUSTOMERS).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
  });

  it('lets other errors through without refreshing', () => {
    signIn();
    let status: number | undefined;

    http.get(CUSTOMERS).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });
    backend.expectOne(CUSTOMERS).flush(null, { status: 403, statusText: 'Forbidden' });

    backend.expectNone(AUTH_ENDPOINTS.refresh);
    expect(status).toBe(403);
  });
});
