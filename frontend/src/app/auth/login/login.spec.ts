import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authResponse } from '../../core/auth/auth.fixtures';
import { AUTH_ENDPOINTS, AuthService } from '../../core/auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    page = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const input = (id: string) => page.querySelector<HTMLInputElement>(`#${id}`)!;

  async function fill(email: string, password: string): Promise<void> {
    for (const [id, value] of [['login-email', email], ['login-password', password]]) {
      input(id).value = value;
      input(id).dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('renders an accessible form with browser autofill hints', () => {
    expect(page.querySelector('h1')?.textContent).toContain('Welcome back');
    expect(page.querySelector('label[for="login-email"]')).toBeTruthy();
    expect(page.querySelector('label[for="login-password"]')).toBeTruthy();
    expect(input('login-email').autocomplete).toBe('email');
    expect(input('login-password').autocomplete).toBe('current-password');
    expect(input('login-password').type).toBe('password');
  });

  it('shows field errors, focuses the first one and does not call the API when the form is invalid', async () => {
    await submit();

    expect(page.querySelector('#login-email-error')?.textContent).toContain('Enter your email.');
    expect(page.querySelector('#login-password-error')).toBeTruthy();
    expect(input('login-email').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('login-email'));
    http.expectNone(AUTH_ENDPOINTS.login);
  });

  it('signs in and goes to the requested page', async () => {
    fixture.componentRef.setInput('returnUrl', '/invoices');
    await fill('jane@acme.fr', 'Correct-horse-42');

    await submit();
    expect(page.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
    http.expectOne(AUTH_ENDPOINTS.login).flush(authResponse());
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/invoices');
  });

  it('ignores a returnUrl pointing to another site', async () => {
    fixture.componentRef.setInput('returnUrl', 'https://evil.example.com');
    await fill('jane@acme.fr', 'Correct-horse-42');

    await submit();
    http.expectOne(AUTH_ENDPOINTS.login).flush(authResponse());

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the server message and clears the password when the credentials are rejected', async () => {
    await fill('jane@acme.fr', 'Wrong-password-1');

    await submit();
    http
      .expectOne(AUTH_ENDPOINTS.login)
      .flush({ status: 401, detail: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Invalid email or password');
    expect(input('login-password').value).toBe('');
    expect(input('login-email').value).toBe('jane@acme.fr');
    expect(page.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
