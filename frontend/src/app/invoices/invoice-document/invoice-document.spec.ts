import { ComponentFixture, TestBed } from '@angular/core/testing';

import { testSeller } from '../../company/company.fixtures';
import { testInvoice, testIssuedInvoice } from '../invoice.fixtures';
import { InvoiceDocumentView, documentFromInvoice } from './invoice-document';

/** Intl uses narrow no-break spaces in French amounts. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

describe('InvoiceDocumentView', () => {
  let fixture: ComponentFixture<InvoiceDocumentView>;
  let page: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(InvoiceDocumentView);
    page = fixture.nativeElement as HTMLElement;
  });

  /** The value printed next to a date label. */
  const date = (label: string) =>
    [...page.querySelectorAll('.dates div')].find((row) => row.querySelector('dt')?.textContent === label)
      ?.querySelector('dd')?.textContent;

  async function render(invoice = testIssuedInvoice()): Promise<void> {
    fixture.componentRef.setInput('doc', documentFromInvoice(invoice, '2026-10-24', '2026-11-23'));
    await fixture.whenStable();
  }

  it('prints the number, dates, customer, lines and totals of an issued invoice', async () => {
    await render(
      testIssuedInvoice({
        lines: [
          { id: 1, productId: 1, type: 'SERVICE', label: 'Web development', details: 'Day rate', quantity: 1.5, unit: 'DAY', unitPrice: 650, vatRate: 20, lineTotal: 975 },
          { id: 2, productId: null, type: 'GOODS', label: 'Keyboard', details: null, quantity: 1, unit: 'UNIT', unitPrice: 49.9, vatRate: 5.5, lineTotal: 49.9 },
        ],
        subtotal: 1024.9,
        vatTotal: 197.74,
        total: 1222.64,
        vatBreakdown: [
          { rate: 20, base: 975, amount: 195 },
          { rate: 5.5, base: 49.9, amount: 2.74 },
        ],
        operationNature: 'MIXED',
        notes: 'Thank you for your trust.',
      }),
    );
    const text = plain(page.textContent);

    expect(page.querySelector('.number')?.textContent).toBe('F-2026-0001');
    expect(page.querySelector('.watermark')).toBeNull();
    expect(date('Issue date')).toBe('20/10/2026');
    expect(date('Due date')).toBe('19/11/2026');
    expect(text).toContain('Acme SAS');
    expect(text).toContain('75002 Paris');
    expect(text).toContain('SIREN 732829320 · SIRET 73282932000074');
    const rows = page.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(plain(rows[0].textContent)).toContain('1,5 day');
    expect(plain(rows[0].textContent)).toContain('975,00 €');
    expect(plain(page.querySelectorAll('.vat')[1]?.textContent)).toBe('VAT 5,5 % on 49,90 €2,74 €');
    expect(plain(page.querySelector('.grand')?.textContent)).toContain('1 222,64 €');
    expect(text).toContain('Nature of the operations: Delivery of goods and provision of services.');
    expect(text).toContain('Payable within 30 days, by 19/11/2026.');
    expect(text).toContain('fixed recovery fee of 40 €');
    expect(text).toContain('Thank you for your trust.');
  });

  it('marks a draft and dates it as if issued today', async () => {
    await render(testInvoice());

    expect(page.querySelector('.watermark')?.textContent).toBe('Draft');
    expect(page.querySelector('.number')?.textContent).toBe('Number given when issued');
    expect(date('Issue date')).toBe('24/10/2026');
    expect(date('Due date')).toBe('23/11/2026');
  });

  it('marks a cancelled invoice', async () => {
    await render(testIssuedInvoice({ status: 'CANCELLED' }));

    expect(page.querySelector('.watermark')?.textContent).toBe('Cancelled');
  });

  it('prints what was already paid and the balance due once a payment is in', async () => {
    await render(testIssuedInvoice({ amountPaid: 560, balance: 1000 }));

    expect(plain(page.querySelector('.totals .paid dd')?.textContent)).toBe('− 560,00 €');
    expect(plain(page.querySelector('.totals .balance dd')?.textContent)).toBe('1 000,00 €');
  });

  it('prints no payment lines on an unpaid invoice', async () => {
    await render();

    expect(page.querySelector('.totals .balance')).toBeNull();
  });

  it('shows placeholders while the draft is empty', async () => {
    await render(
      testInvoice({ customerId: null, customer: { ...testInvoice().customer, name: null }, lines: [], operationNature: null }),
    );

    expect(page.textContent).toContain('Choose a customer');
    expect(page.textContent).toContain('No line yet');
    expect(page.textContent).not.toContain('Nature of the operations');
  });

  describe('seller', () => {
    it('prints the identity of the seller with its legal form and share capital', async () => {
      await render();
      const seller = plain(page.querySelector('.seller')?.textContent);

      expect(plain(page.querySelector('.seller strong')?.textContent)).toBe('Durand Conseil');
      expect(seller).toContain('Atelier Durand');
      expect(seller).toContain('SAS au capital de 10 000 €');
      expect(seller).toContain('8 rue des Tilleuls');
      expect(seller).toContain('69003 Lyon');
      expect(seller).toContain('SIREN 732829320 · SIRET 73282932000074');
      expect(seller).toContain('VAT FR44732829320');
      expect(seller).toContain('RCS Lyon 732 829 320');
      expect(seller).toContain('contact@durand.test');
      expect(seller).toContain('+33 4 12 34 56 78');
      expect(plain(page.querySelector('.legal')?.textContent)).toContain(
        'Bank transfer: IBAN FR7630006000011234567890189 · BIC AGRIFRPP',
      );
      expect(page.querySelector('.franchise')).toBeNull();
    });

    it('leaves out what the company does not have', async () => {
      await render(
        testIssuedInvoice({
          seller: testSeller({
            tradeName: null,
            legalForm: 'EI_MICRO',
            shareCapital: null,
            vatNumber: null,
            registration: null,
            email: null,
            phone: null,
            iban: null,
            bic: null,
          }),
        }),
      );
      const seller = plain(page.querySelector('.seller')?.textContent);

      expect(seller).toContain('EI');
      expect(seller).not.toContain('Micro-entrepreneur');
      expect(seller).not.toContain('au capital');
      expect(seller).not.toContain('VAT');
      expect(page.querySelector('.trade-name')).toBeNull();
      expect(page.querySelector('.legal')?.textContent).not.toContain('IBAN');
    });

    it('shows a share capital with cents and no form for the other legal form', async () => {
      await render(testIssuedInvoice({ seller: testSeller({ legalForm: 'SARL', shareCapital: 1500.5, iban: 'FR76', bic: null }) }));

      expect(plain(page.querySelector('.seller')?.textContent)).toContain('SARL au capital de 1 500,50 €');
      expect(plain(page.querySelector('.legal')?.textContent)).toContain('Bank transfer: IBAN FR76');
      expect(page.querySelector('.legal')?.textContent).not.toContain('BIC');

      await render(testIssuedInvoice({ seller: testSeller({ legalForm: 'OTHER', shareCapital: null }) }));
      expect(plain(page.querySelector('.seller')?.textContent)).not.toContain('au capital');

      await render(testIssuedInvoice({ seller: testSeller({ legalForm: 'OTHER', shareCapital: 5000 }) }));
      expect(plain(page.querySelector('.seller')?.textContent)).toContain('Au capital de 5 000 €');
    });

    it('prints the franchise mention under the VAT exemption', async () => {
      await render(testIssuedInvoice({ seller: testSeller({ vatRegime: 'FRANCHISE', vatNumber: null }) }));

      expect(page.querySelector('.franchise')?.textContent).toBe('TVA non applicable, art. 293 B du CGI');
    });

    it('says the company details are missing when there is no seller', async () => {
      await render(testInvoice({ seller: null }));

      expect(page.querySelector('.seller .pending')?.textContent).toContain('Your company');
      expect(plain(page.querySelector('.seller')?.textContent)).toContain('Company details missing');
    });

    it('does not ask for company details on an invoice issued before they existed', async () => {
      await render(testIssuedInvoice({ seller: null }));

      const seller = plain(page.querySelector('.seller')?.textContent);
      expect(seller).toContain('Issued before the company details were recorded.');
      expect(seller).not.toContain('missing');
    });
  });
});
