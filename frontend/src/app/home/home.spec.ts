import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { authResponse } from '../core/auth/auth.fixtures';
import { AUTH_ENDPOINTS, AuthService } from '../core/auth/auth.service';
import { formatEuros } from '../shared/format/money';
import { Home } from './home';

describe('Home', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    http.expectOne(`${environment.apiUrl}/actuator/health`).flush({ status: 'UP' });
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the hero headline and every section', async () => {
    const page = await render();

    expect(page.querySelector('h1')?.textContent).toContain('right to the cent');
    for (const id of ['product', 'reform', 'engineering', 'ai', 'get-started']) {
      expect(page.querySelector(`#${id}`)).toBeTruthy();
    }
    expect(page.querySelectorAll('#product .ledger li').length).toBe(6);
    expect(page.querySelectorAll('#engineering .practices li').length).toBe(6);
  });

  it('renders the sample invoice with the app document component and exact totals', async () => {
    const page = await render();

    // 3 × 450 + 150 at 20 %, 2 × 16 at 5.5 %: 1,532.00 excl. VAT + 300.00 + 1.76 VAT
    const invoice = page.querySelector('.hero app-invoice-document');
    expect(invoice?.textContent).toContain('F-2026-0042');
    expect(invoice?.textContent).toContain(formatEuros(1833.76));
    expect(page.querySelector('.ai .total')?.textContent).toContain('€1,620.00');
  });

  it('shows the live API status', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const pill = () => (fixture.nativeElement as HTMLElement).querySelector('app-api-status-pill');

    expect(pill()?.textContent).toContain('Connecting');

    http.expectOne(`${environment.apiUrl}/actuator/health`).flush({ status: 'UP' });
    await fixture.whenStable();
    expect(pill()?.textContent).toContain('API online');
  });

  it('invites visitors to sign in or create an account', async () => {
    const page = await render();

    const header = page.querySelector('app-site-header')!;
    expect(header.querySelector('a[href="/login"]')?.textContent).toContain('Sign in');
    expect(header.querySelector('a[href="/register"]')?.textContent).toContain('Get started');
    expect(page.querySelector('#get-started a[href="/register"]')).toBeTruthy();
  });

  it('takes signed-in users to their dashboard', async () => {
    localStorage.clear();
    TestBed.inject(AuthService).login({ email: 'jane@acme.fr', password: 'Correct-horse-42' }).subscribe();
    http.expectOne(AUTH_ENDPOINTS.login).flush(authResponse());

    const page = await render();

    const header = page.querySelector('app-site-header')!;
    expect(header.querySelector('a[href="/dashboard"]')?.textContent).toContain('Open dashboard');
    expect(header.querySelector('a[href="/login"]')).toBeNull();
  });
});
