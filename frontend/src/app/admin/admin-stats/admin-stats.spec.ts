import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testStats } from '../admin.fixtures';
import { ADMIN_API } from '../admin.service';
import { AdminStats } from './admin-stats';

describe('AdminStats', () => {
  let fixture: ComponentFixture<AdminStats>;
  let host: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminStats);
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  it('shows placeholders, then the platform figures', async () => {
    await fixture.whenStable();
    expect(host.querySelector('[aria-label="Loading platform figures"]')).toBeTruthy();

    http.expectOne(`${ADMIN_API}/stats`).flush(testStats());
    await fixture.whenStable();

    const tiles = [...host.querySelectorAll('.tile')].map((tile) => [
      tile.querySelector('dt')?.textContent,
      tile.querySelector('dd')?.textContent,
    ]);
    expect(tiles).toEqual([
      ['Accounts', '12'],
      ['New in 30 days', '4'],
      ['Admins', '2'],
      ['Suspended', '1'],
      ['Customers', '30'],
      ['Invoices issued', '57'],
    ]);
  });

  it('says so when the figures cannot be loaded', async () => {
    await fixture.whenStable();
    http.expectOne(`${ADMIN_API}/stats`).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(host.querySelector('.unavailable')?.textContent).toContain('unavailable');
  });
});
