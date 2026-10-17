import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { Home } from './home';

describe('Home', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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

    expect(page.querySelector('h1')?.textContent).toContain('e-invoicing era');
    for (const id of ['features', 'reform', 'ai', 'how-it-works', 'get-started']) {
      expect(page.querySelector(`#${id}`)).toBeTruthy();
    }
    expect(page.querySelectorAll('#features .card').length).toBe(6);
  });

  it('computes the sample invoice totals with 20% VAT', async () => {
    const page = await render();

    expect(page.querySelector('.hero .totals .grand')?.textContent).toContain('€1,800.00');
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
});
