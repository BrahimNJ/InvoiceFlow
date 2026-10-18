import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authResponse } from '../core/auth/auth.fixtures';
import { AUTH_ENDPOINTS, AuthService } from '../core/auth/auth.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).login({ email: 'jane@acme.fr', password: 'Correct-horse-42' }).subscribe();
    http.expectOne(AUTH_ENDPOINTS.login).flush(authResponse());
  });

  afterEach(() => http.verify());

  it('greets the signed-in user and shows the account', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('h1')?.textContent).toContain('Welcome, Jane');
    expect(page.querySelector('dl')?.textContent).toContain('jane@acme.fr');
  });

  it('signs out and goes back to the sign-in page', async () => {
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.account button')!.click();
    http.expectOne(AUTH_ENDPOINTS.logout).flush(null, { status: 204, statusText: 'No Content' });

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
