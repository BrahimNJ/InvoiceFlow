import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { TEST_USER, authResponse } from '../core/auth/auth.fixtures';
import { AUTH_ENDPOINTS, AuthService } from '../core/auth/auth.service';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
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

  it('links to the business screens and shows the signed-in user', async () => {
    const fixture = TestBed.createComponent(AppHeader);
    await fixture.whenStable();
    const header = fixture.nativeElement as HTMLElement;

    const links = [...header.querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Dashboard', '/dashboard'],
      ['Customers', '/customers'],
      ['Products', '/products'],
      ['Invoices', '/invoices'],
      ['Company', '/company'],
    ]);
    expect(header.querySelectorAll('nav a app-icon').length).toBe(5);
    expect(header.querySelector('.who')?.textContent).toContain('Jane Doe');
  });

  it('adds the admin area for an admin', async () => {
    TestBed.inject(AuthService).login({ email: 'admin@acme.fr', password: 'Correct-horse-42' }).subscribe();
    http
      .expectOne(AUTH_ENDPOINTS.login)
      .flush({ ...authResponse(), user: { ...TEST_USER, email: 'admin@acme.fr', role: 'ADMIN' } });
    const fixture = TestBed.createComponent(AppHeader);
    await fixture.whenStable();

    const last = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('nav a')].at(-1);
    expect(last?.textContent?.trim()).toBe('Admin');
    expect(last?.getAttribute('href')).toBe('/admin');
  });

  it('signs out and goes back to the sign-in page', async () => {
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AppHeader);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.account button.btn')!.click();
    http.expectOne(AUTH_ENDPOINTS.logout).flush(null, { status: 204, statusText: 'No Content' });

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
