import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ToastService } from '../../shared/ui/toast.service';
import { testProduct } from '../product.fixtures';
import { PRODUCTS_API } from '../product.service';
import { ProductForm } from './product-form';

/** Intl uses narrow no-break spaces in French amounts. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ProductForm);
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

  const control = <T extends HTMLElement = HTMLInputElement>(field: string) =>
    page.querySelector<T>(`#product-${field}`)!;
  /** The `[value]` binding sets a property, not an attribute: radios are found by their card title. */
  const radio = (title: 'Service' | 'Goods') =>
    [...page.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
      (input) => input.closest('label')?.querySelector('strong')?.textContent === title,
    )!;
  const previewRow = (label: string) =>
    [...page.querySelectorAll('.preview dl div')].find((row) => row.querySelector('dt')?.textContent?.startsWith(label));

  async function fill(values: Record<string, string>): Promise<void> {
    for (const [field, value] of Object.entries(values)) {
      control(field).value = value;
      control(field).dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  async function choose(field: string, optionText: string): Promise<void> {
    const select = control<HTMLSelectElement>(field);
    select.selectedIndex = [...select.options].findIndex((option) => option.textContent?.includes(optionText));
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  describe('creating', () => {
    beforeEach(() => open());

    it('explains each section and field', () => {
      expect(page.querySelector('h1')?.textContent).toContain('New product');
      expect([...page.querySelectorAll('legend')].map((legend) => legend.textContent?.trim())).toEqual([
        'What do you sell?',
        'Details',
        'Price and VAT',
      ]);
      expect(page.querySelectorAll('.section-help').length).toBe(3);
      for (const field of ['name', 'description', 'unitPrice', 'unit', 'vatRate']) {
        expect(page.querySelector(`label[for="product-${field}"]`)).toBeTruthy();
        expect(page.querySelector(`#product-${field}-hint`)).toBeTruthy();
      }
      expect(control('unitPrice').getAttribute('inputmode')).toBe('decimal');
      expect(page.querySelector('button[type="submit"]')?.textContent).toContain('Add to catalogue');
    });

    it('starts as a service at 20 % VAT, sold per unit', () => {
      expect(radio('Service').checked).toBe(true);
      expect(radio('Service').closest('label')?.classList).toContain('selected');
      expect(control<HTMLSelectElement>('vatRate').selectedOptions[0].textContent).toContain('20 % · Standard rate');
      expect(control<HTMLSelectElement>('unit').selectedOptions[0].textContent).toContain('Unit');
      expect(page.querySelector('#product-vatRate-hint')?.textContent).toContain('most goods and services');
    });

    it('previews the price including VAT and explains the chosen rate', async () => {
      expect(page.querySelector('.preview')?.textContent).toContain('Enter a price');

      await fill({ unitPrice: '650' });
      await choose('unit', 'Day');
      expect(plain(page.querySelector('.preview')?.textContent)).toContain('one day costs');
      expect(plain(page.querySelector('.preview .total')?.textContent)).toContain('780,00 €');

      await choose('vatRate', 'Reduced rate');
      expect(previewRow('VAT')?.querySelector('dt')?.textContent).toBe('VAT 5,5 %');
      expect(plain(previewRow('VAT')?.querySelector('dd')?.textContent)).toBe('35,75 €');
      expect(plain(page.querySelector('.preview .total')?.textContent)).toContain('685,75 €');
      expect(page.querySelector('#product-vatRate-hint')?.textContent).toContain('Food, books');
    });

    it('counts the description characters', async () => {
      await fill({ description: 'Remote work' });

      expect(page.querySelector('.counter')?.textContent?.trim()).toBe('11 / 1000');
    });

    it('validates like the backend, focuses the first error and does not call the API', async () => {
      await fill({ unitPrice: '12,345', description: 'x'.repeat(1001) });

      await submit();

      expect(page.querySelector('#product-name-error')?.textContent).toContain('Enter the name');
      expect(page.querySelector('#product-unitPrice-error')?.textContent).toContain('at most 2 decimals');
      expect(page.querySelector('#product-description-error')?.textContent).toContain('at most 1000 characters');
      expect(page.querySelector('.counter')?.classList).toContain('over');
      expect(control('name').getAttribute('aria-invalid')).toBe('true');
      expect(control('name').getAttribute('aria-describedby')).toBe('product-name-error');
      expect(document.activeElement).toBe(control('name'));
      http.expectNone(PRODUCTS_API);
    });

    it('creates the product with a parsed price, then confirms and goes back to the catalogue', async () => {
      radio('Goods').click();
      await fill({ name: '  Keyboard ', unitPrice: '1 049,9' });
      await choose('vatRate', 'Reduced rate');
      expect(radio('Goods').closest('label')?.classList).toContain('selected');

      await submit();
      expect(page.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
      const request = http.expectOne(PRODUCTS_API);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        type: 'GOODS',
        name: 'Keyboard',
        description: null,
        unitPrice: 1049.9,
        vatRate: 5.5,
        unit: 'UNIT',
      });
      request.flush(testProduct({ name: 'Keyboard' }));
      await fixture.whenStable();

      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('“Keyboard” was added to your catalogue.');
      expect(navigateByUrl).toHaveBeenCalledWith('/products');
    });

    it('shows the backend validation errors on the fields', async () => {
      await fill({ name: 'Keyboard', unitPrice: '10' });

      await submit();
      http.expectOne(PRODUCTS_API).flush(
        {
          status: 400,
          detail: 'Validation failed',
          errors: { vatRate: 'must be one of the French VAT rates: 20, 10, 5.5, 2.1 or 0' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('Please check the highlighted fields.');
      expect(page.querySelector('#product-vatRate-error')?.textContent).toContain('French VAT rates');
      expect(document.activeElement).toBe(control('vatRate'));
      expect(navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('editing', () => {
    it('loads the product, then saves the changes', async () => {
      await open('1');
      expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading the product');
      http.expectOne(`${PRODUCTS_API}/1`).flush(testProduct({ vatRate: 5.5, description: null }));
      await fixture.whenStable();

      expect(page.querySelector('h1')?.textContent).toContain('Edit product');
      expect(radio('Service').checked).toBe(true);
      expect(control('name').value).toBe('Web development');
      expect(control<HTMLTextAreaElement>('description').value).toBe('');
      expect(control('unitPrice').value).toBe('650,00');
      expect(control<HTMLSelectElement>('unit').selectedOptions[0].textContent).toContain('Day');
      expect(control<HTMLSelectElement>('vatRate').selectedOptions[0].textContent).toContain('5,5 %');

      await fill({ unitPrice: '700.5' });
      await submit();
      const request = http.expectOne(`${PRODUCTS_API}/1`);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toMatchObject({ name: 'Web development', unitPrice: 700.5, vatRate: 5.5, unit: 'DAY' });
      request.flush(testProduct({ unitPrice: 700.5 }));
      await fixture.whenStable();

      expect(TestBed.inject(ToastService).toasts()[0].message).toBe('“Web development” was saved.');
      expect(navigateByUrl).toHaveBeenCalledWith('/products');
    });

    it('explains when the product does not exist (or belongs to someone else)', async () => {
      await open('42');
      http
        .expectOne(`${PRODUCTS_API}/42`)
        .flush({ status: 404, detail: 'Product with id 42 not found' }, { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('does not exist or has been deleted');
      expect(page.querySelector('form')).toBeNull();
    });
  });
});
