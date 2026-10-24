import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testCustomer } from '../customer.fixtures';
import { CUSTOMERS_API } from '../customer.service';
import { CustomerDrawer } from './customer-drawer';

describe('CustomerDrawer', () => {
  let fixture: ComponentFixture<CustomerDrawer>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let created: unknown[];
  let closed: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CustomerDrawer);
    page = fixture.nativeElement as HTMLElement;
    created = [];
    closed = 0;
    fixture.componentInstance.created.subscribe((customer) => created.push(customer));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentRef.setInput('name', 'Globex');
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  async function type(id: string, value: string): Promise<void> {
    const input = page.querySelector<HTMLInputElement>(`#drawer-${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('is a dialog prefilled with the searched name', () => {
    expect(page.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(page.querySelector<HTMLInputElement>('#drawer-name')?.value).toBe('Globex');
  });

  it('creates the customer with what an invoice needs', async () => {
    await type('email', 'billing@globex.test');
    await type('street', '5 avenue Foch');
    await type('postalCode', '69006');
    await type('city', 'Lyon');
    await type('siret', '73282932000074');
    await submit();

    const request = http.expectOne(CUSTOMERS_API);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Globex',
      email: 'billing@globex.test',
      phone: null,
      street: '5 avenue Foch',
      postalCode: '69006',
      city: 'Lyon',
      country: 'France',
      siret: '73282932000074',
      vatNumber: null,
    });
    request.flush(testCustomer({ id: 9, name: 'Globex' }));
    await fixture.whenStable();

    expect(created).toEqual([expect.objectContaining({ id: 9, name: 'Globex' })]);
  });

  it('validates the fields before sending', async () => {
    await type('email', 'not an email');
    await type('siret', '123');
    await submit();

    http.expectNone(CUSTOMERS_API);
    expect(page.querySelector('#drawer-email-error')?.textContent).toBe('Enter an email like billing@company.fr.');
    expect(page.querySelector('#drawer-siret-error')?.textContent).toBe('A SIRET is made of exactly 14 digits.');
  });

  it('closes with the close button, the backdrop or Escape', async () => {
    page.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
    page.querySelector<HTMLElement>('.backdrop')!.click();
    (fixture.nativeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toBe(3);
  });
});
