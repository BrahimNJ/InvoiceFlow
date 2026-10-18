import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authResponse } from '../../core/auth/auth.fixtures';
import { AUTH_ENDPOINTS, AuthService } from '../../core/auth/auth.service';
import { Register } from './register';

const VALID = {
  'register-first-name': 'Jane',
  'register-last-name': 'Doe',
  'register-email': 'jane@acme.fr',
  'register-password': 'Correct-horse-42',
  'register-confirm-password': 'Correct-horse-42',
};

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
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
    fixture = TestBed.createComponent(Register);
    page = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const input = (id: string) => page.querySelector<HTMLInputElement>(`#${id}`)!;
  const errorOf = (id: string) => page.querySelector(`#${id}-error`)?.textContent?.trim();

  async function fill(values: Partial<typeof VALID>): Promise<void> {
    for (const [id, value] of Object.entries(values)) {
      input(id).value = value;
      input(id).dispatchEvent(new Event('input'));
      input(id).dispatchEvent(new Event('blur'));
    }
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('uses autofill hints that let password managers generate a password', () => {
    expect(input('register-first-name').autocomplete).toBe('given-name');
    expect(input('register-last-name').autocomplete).toBe('family-name');
    expect(input('register-password').autocomplete).toBe('new-password');
    expect(input('register-confirm-password').autocomplete).toBe('new-password');
  });

  it('reports every missing field and focuses the first one', async () => {
    await submit();

    expect(errorOf('register-first-name')).toBe('Enter your first name.');
    expect(errorOf('register-email')).toBe('Enter your email.');
    expect(errorOf('register-password')).toBe('Choose a password.');
    expect(document.activeElement).toBe(input('register-first-name'));
    http.expectNone(AUTH_ENDPOINTS.register);
  });

  it('applies the backend password policy and shows the missing rules live', async () => {
    await fill({ ...VALID, 'register-password': 'alllowercase', 'register-confirm-password': 'alllowercase' });

    expect(errorOf('register-password')).toContain('does not meet all the requirements');
    const missing = Array.from(page.querySelectorAll('app-password-strength li:not(.met)')).map((li) => li.textContent);
    expect(missing.join()).toContain('One uppercase letter');
    expect(missing.join()).toContain('One digit');

    await submit();
    http.expectNone(AUTH_ENDPOINTS.register);
  });

  it('asks for matching passwords', async () => {
    await fill({ ...VALID, 'register-confirm-password': 'Correct-horse-43' });

    await submit();

    expect(errorOf('register-confirm-password')).toBe('Passwords do not match.');
    expect(input('register-confirm-password').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('register-confirm-password'));
    http.expectNone(AUTH_ENDPOINTS.register);
  });

  it('creates the account, without the confirmation field, and opens the app', async () => {
    await fill(VALID);

    await submit();
    const request = http.expectOne(AUTH_ENDPOINTS.register);
    expect(request.request.body).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.fr',
      password: 'Correct-horse-42',
    });
    request.flush(authResponse(), { status: 201, statusText: 'Created' });
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('points at the email field when the account already exists', async () => {
    await fill(VALID);

    await submit();
    http
      .expectOne(AUTH_ENDPOINTS.register)
      .flush(
        { status: 409, detail: 'An account already exists with this email' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('An account already exists');
    expect(errorOf('register-email')).toContain('This email is already used by an account.');
    expect(page.querySelector('#register-email-error a')?.getAttribute('href')).toBe('/login');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows backend validation messages on the matching fields', async () => {
    await fill(VALID);

    await submit();
    http.expectOne(AUTH_ENDPOINTS.register).flush(
      { status: 400, detail: 'Validation failed', errors: { lastName: 'size must be between 0 and 100' } },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(errorOf('register-last-name')).toBe('size must be between 0 and 100');
    expect(document.activeElement).toBe(input('register-last-name'));
  });
});
