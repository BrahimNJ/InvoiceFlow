import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { testCustomer } from '../customer.fixtures';
import { CUSTOMERS_API } from '../customer.service';
import { CustomerForm } from './customer-form';

describe('CustomerForm', () => {
  let fixture: ComponentFixture<CustomerForm>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(CustomerForm);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  /** Starts the component, as the router does: in edit mode the `id` input is set before the first render. */
  async function open(id?: string): Promise<void> {
    if (id !== undefined) {
      fixture.componentRef.setInput('id', id);
    }
    await fixture.whenStable();
  }

  const input = (field: string) => page.querySelector<HTMLInputElement>(`#customer-${field}`)!;

  async function fill(values: Record<string, string>): Promise<void> {
    for (const [field, value] of Object.entries(values)) {
      input(field).value = value;
      input(field).dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  describe('creating', () => {
    beforeEach(() => open());

    it('renders a labelled form with autofill hints', () => {
      expect(page.querySelector('h1')?.textContent).toContain('New customer');
      expect(page.querySelectorAll('fieldset legend').length).toBe(3);
      for (const field of ['name', 'email', 'phone', 'street', 'postalCode', 'city', 'country', 'siret', 'vatNumber']) {
        expect(page.querySelector(`label[for="customer-${field}"]`)).toBeTruthy();
      }
      expect(input('name').autocomplete).toBe('organization');
      expect(input('email').type).toBe('email');
      expect(input('siret').getAttribute('inputmode')).toBe('numeric');
      expect(page.querySelector('button[type="submit"]')?.textContent).toContain('Create customer');
    });

    it('validates like the backend, focuses the first error and does not call the API', async () => {
      await fill({ email: 'not-an-email', siret: '123', postalCode: '12345678901' });

      await submit();

      expect(page.querySelector('#customer-name-error')?.textContent).toContain('Enter the customer name.');
      expect(page.querySelector('#customer-email-error')?.textContent).toContain('valid email');
      expect(page.querySelector('#customer-siret-error')?.textContent).toContain('14 digits');
      expect(page.querySelector('#customer-postalCode-error')?.textContent).toContain('at most 10 characters');
      expect(input('name').getAttribute('aria-invalid')).toBe('true');
      expect(input('name').getAttribute('aria-describedby')).toBe('customer-name-error');
      expect(document.activeElement).toBe(input('name'));
      http.expectNone(CUSTOMERS_API);
    });

    it('creates the customer with trimmed values, empty optional fields as null, then goes back to the list', async () => {
      await fill({ name: '  ACME ', email: 'contact@acme.fr', city: ' Paris', siret: '12345678901234' });

      await submit();
      expect(page.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
      const request = http.expectOne(CUSTOMERS_API);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        name: 'ACME',
        email: 'contact@acme.fr',
        phone: null,
        street: null,
        postalCode: null,
        city: 'Paris',
        country: null,
        siret: '12345678901234',
        vatNumber: null,
      });
      request.flush(testCustomer());
      await fixture.whenStable();

      expect(navigateByUrl).toHaveBeenCalledWith('/customers');
    });

    it('shows the backend validation errors on the fields', async () => {
      await fill({ name: 'ACME', email: 'contact@acme.fr' });

      await submit();
      http.expectOne(CUSTOMERS_API).flush(
        { status: 400, detail: 'Validation failed', errors: { email: 'must be a well-formed email address' } },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('Please check the highlighted fields.');
      expect(page.querySelector('#customer-email-error')?.textContent).toContain('must be a well-formed email address');
      expect(document.activeElement).toBe(input('email'));
      expect(navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('loads the customer, then saves the changes', async () => {
      await open('1');
      expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading the customer');
      http.expectOne(`${CUSTOMERS_API}/1`).flush(testCustomer({ phone: null }));
      await fixture.whenStable();

      expect(page.querySelector('h1')?.textContent).toContain('Edit customer');
      expect(input('name').value).toBe('ACME');
      expect(input('phone').value).toBe('');
      expect(input('siret').value).toBe('12345678901234');

      await fill({ name: 'ACME Corp' });
      await submit();
      const request = http.expectOne(`${CUSTOMERS_API}/1`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toMatchObject({ name: 'ACME Corp', phone: null, city: 'Paris' });
      request.flush(testCustomer({ name: 'ACME Corp' }));
      await fixture.whenStable();

      expect(navigateByUrl).toHaveBeenCalledWith('/customers');
    });

    it('explains when the customer does not exist (or belongs to someone else)', async () => {
      await open('42');
      http
        .expectOne(`${CUSTOMERS_API}/42`)
        .flush({ status: 404, detail: 'Customer with id 42 not found' }, { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('does not exist or has been deleted');
      expect(page.querySelector('form')).toBeNull();
    });
  });
});
