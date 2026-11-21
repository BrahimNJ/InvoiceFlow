import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ToastService } from '../../shared/ui/toast.service';
import { testCompany } from '../company.fixtures';
import { Company } from '../company.models';
import { COMPANY_API } from '../company.service';
import { CompanySettings, toFormValue, toPayload } from './company-settings';

describe('CompanySettings', () => {
  let fixture: ComponentFixture<CompanySettings>;
  let page: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CompanySettings);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  /** Starts the component and answers the load: 404 (no company yet) or the company. */
  async function open(company: Company | null): Promise<void> {
    await fixture.whenStable();
    const request = http.expectOne(COMPANY_API);
    if (company) {
      request.flush(company);
    } else {
      request.flush({ detail: 'No company details recorded yet' }, { status: 404, statusText: 'Not Found' });
    }
    await fixture.whenStable();
  }

  const control = (field: string) => page.querySelector<HTMLInputElement & HTMLSelectElement>(`#company-${field}`)!;

  async function fill(values: Record<string, string>): Promise<void> {
    for (const [field, value] of Object.entries(values)) {
      control(field).value = value;
      control(field).dispatchEvent(new Event(control(field).tagName === 'SELECT' ? 'change' : 'input'));
      // A field can appear once another one is set (share capital after the legal form)
      await fixture.whenStable();
    }
  }

  async function submit(): Promise<void> {
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const error = (field: string) => page.querySelector(`#company-${field}-error`)?.textContent?.trim();

  const VALID = {
    legalName: 'Durand Conseil',
    legalForm: 'SAS',
    shareCapital: '10 000',
    street: '8 rue des Tilleuls',
    postalCode: '69003',
    city: 'Lyon',
    siret: '73282932000074',
    vatRegime: 'STANDARD',
    vatNumber: 'FR44732829320',
  };

  describe('before the first save', () => {
    beforeEach(() => open(null));

    it('introduces the form and shows every section, labelled and explained', () => {
      expect(page.querySelector('h1')?.textContent).toBe('Company');
      expect(page.querySelector('.intro')?.textContent).toContain('cannot be issued without it');
      expect(page.querySelector('app-help-tip')?.textContent).toContain('SIRET');
      expect(page.querySelector('app-help-tip')?.textContent).toContain('293 B');
      expect([...page.querySelectorAll('fieldset legend')].map((legend) => legend.textContent?.trim())).toEqual([
        'Identity',
        'Address',
        'Tax & registration',
        'Contact',
        'Bank details',
      ]);
      for (const field of ['legalName', 'tradeName', 'legalForm', 'street', 'siret', 'vatRegime', 'vatNumber', 'email', 'phone', 'iban', 'bic']) {
        expect(page.querySelector(`label[for="company-${field}"]`)).toBeTruthy();
        expect(control(field).getAttribute('aria-describedby')).toBe(`company-${field}-hint`);
      }
      expect(control('country').value).toBe('France');
      expect(control('phone').type).toBe('tel');
      expect(control('siret').getAttribute('inputmode')).toBe('numeric');
    });

    it('asks for the share capital only for a legal form that has one', async () => {
      expect(control('shareCapital')).toBeNull();

      await fill({ legalForm: 'SAS' });
      expect(control('shareCapital')).toBeTruthy();

      await fill({ legalForm: 'EI_MICRO' });
      expect(control('shareCapital')).toBeNull();
    });

    it('reports the required fields without calling the API and focuses the first one', async () => {
      await fill({ legalForm: 'SARL' });

      await submit();

      expect(error('legalName')).toBe('Enter the legal name of your company.');
      expect(error('shareCapital')).toContain('share capital');
      expect(error('street')).toBe('Enter the street.');
      expect(error('siret')).toBe('Enter your SIRET.');
      expect(error('vatRegime')).toBe('Choose the VAT regime.');
      expect(control('legalName').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(control('legalName'));
    });

    it('checks the SIRET, VAT number, IBAN, BIC, email and capital like the backend', async () => {
      await fill({
        ...VALID,
        siret: '73282932000075',
        vatNumber: 'FR45732829320',
        shareCapital: 'a lot',
        email: 'nope',
        iban: 'FR7630006000011234567890188',
        bic: 'AGRI',
      });

      await submit();

      expect(error('siret')).toContain('14 digits');
      expect(error('vatNumber')).toContain('Not a valid VAT number');
      expect(error('shareCapital')).toContain('An amount');
      expect(error('email')).toBe('Enter a valid email address.');
      expect(error('iban')).toContain('Not a valid IBAN');
      expect(error('bic')).toContain('8 or 11');
    });

    it('requires a VAT number when subject to VAT, and not under the franchise', async () => {
      await fill({ ...VALID, vatNumber: '' });
      await submit();
      expect(error('vatNumber')).toContain('required when subject to VAT');

      await fill({ vatRegime: 'FRANCHISE' });
      expect(error('vatNumber')).toBeUndefined();
      expect(page.querySelector('.franchise-note')?.textContent).toContain('TVA non applicable, art. 293 B du CGI');

      await fill({ vatRegime: 'STANDARD' });
      expect(page.querySelector('.franchise-note')).toBeNull();
    });

    it('checks the VAT number again when the SIRET changes', async () => {
      await fill({ ...VALID, siret: '12345678900010' });
      await submit();
      expect(error('vatNumber')).toContain('Not a valid VAT number');

      await fill({ siret: '73282932000074' });
      expect(error('vatNumber')).toBeUndefined();
    });

    it('saves the trimmed company, thanks the user and takes the intro away', async () => {
      const success = vi.spyOn(TestBed.inject(ToastService), 'success');
      await fill({ ...VALID, legalName: '  Durand Conseil ', tradeName: '', registration: ' RCS Lyon 732 829 320 ', phone: '' });

      await submit();

      const request = http.expectOne(COMPANY_API);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        legalName: 'Durand Conseil',
        tradeName: null,
        legalForm: 'SAS',
        shareCapital: 10000,
        street: '8 rue des Tilleuls',
        postalCode: '69003',
        city: 'Lyon',
        country: 'France',
        siret: '73282932000074',
        vatNumber: 'FR44732829320',
        vatRegime: 'STANDARD',
        registration: 'RCS Lyon 732 829 320',
        email: null,
        phone: null,
        iban: null,
        bic: null,
      });
      request.flush(testCompany());
      await fixture.whenStable();

      expect(success).toHaveBeenCalledWith('Company details saved.');
      expect(page.querySelector('.intro')).toBeNull();
      expect(page.querySelector('[role="alert"]')).toBeNull();
    });

    it('shows the messages of the server under the matching fields', async () => {
      await fill(VALID);
      await submit();

      http
        .expectOne(COMPANY_API)
        .flush(
          { detail: 'Validation failed', errors: { siret: 'Unknown SIRET', iban: 'IBAN rejected' } },
          { status: 400, statusText: 'Bad Request' },
        );
      await fixture.whenStable();

      expect(page.querySelector('[role="alert"]')?.textContent).toContain('Please check the highlighted fields.');
      expect(error('siret')).toBe('Unknown SIRET');
      expect(error('iban')).toBe('IBAN rejected');
      expect(document.activeElement).toBe(control('siret'));

      // Editing a field clears its server message
      await fill({ siret: '73282932000074' });
      expect(error('siret')).toBeUndefined();
    });

    it('ignores a second submit while the first is running', async () => {
      await fill(VALID);
      await submit();
      await submit();

      expect(http.match(COMPANY_API).length).toBe(1);
    });
  });

  describe('with a recorded company', () => {
    it('fills the form with it and keeps the capital hidden for a form without one', async () => {
      await open(testCompany());

      expect(page.querySelector('.intro')).toBeNull();
      expect(control('legalName').value).toBe('Durand Conseil');
      expect(control('legalForm').value).toBe('SAS');
      expect(control('shareCapital').value).toBe('10000,00');
      expect(control('vatRegime').value).toBe('STANDARD');
      expect(control('iban').value).toBe('FR7630006000011234567890189');
    });

    it('fills optional fields with nothing when the company has none', async () => {
      await open(
        testCompany({ legalForm: 'EI', shareCapital: null, tradeName: null, vatNumber: null, vatRegime: 'FRANCHISE', registration: null, email: null, phone: null, iban: null, bic: null }),
      );

      expect(control('tradeName').value).toBe('');
      expect(control('shareCapital')).toBeNull();
      expect(control('vatRegime').value).toBe('FRANCHISE');
      expect(page.querySelector('.franchise-note')).toBeTruthy();
    });
  });

  it('shows why the company could not be loaded, without the form', async () => {
    await fixture.whenStable();
    http.expectOne(COMPANY_API).flush({ detail: 'Boom' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Boom');
    expect(page.querySelector('form')).toBeNull();
  });
});

describe('company form conversion', () => {
  it('sends no share capital for a legal form without one', () => {
    const value = { ...toFormValue(testCompany()), legalForm: 'EI' as const, shareCapital: '10 000', siret: '732 829 320 00074' };

    const payload = toPayload(value);

    expect(payload.shareCapital).toBeNull();
    expect(payload.siret).toBe('73282932000074');
  });

  it('round-trips a company', () => {
    const { id: _id, siren: _siren, createdAt: _c, updatedAt: _u, ...payload } = testCompany({ shareCapital: 1500.5 });

    expect(toPayload(toFormValue(testCompany({ shareCapital: 1500.5 })))).toEqual(payload);
  });
});
