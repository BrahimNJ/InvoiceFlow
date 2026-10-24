import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { addDays, todayIso } from '../invoice-calc';
import { testInvoice, testIssuedInvoice } from '../invoice.fixtures';
import { Invoice } from '../invoice.models';
import { INVOICES_API } from '../invoice.service';
import { InvoiceDetail } from './invoice-detail';

const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

describe('InvoiceDetail', () => {
  let fixture: ComponentFixture<InvoiceDetail>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.spyOn>;
  const today = todayIso();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    confirm = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);
    fixture = TestBed.createComponent(InvoiceDetail);
    page = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('id', '1');
  });

  afterEach(() => http.verify());

  async function open(invoice: Invoice): Promise<void> {
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush(invoice);
    await fixture.whenStable();
  }

  const button = (label: string) =>
    [...page.querySelectorAll<HTMLButtonElement>('button, a')].find((b) => plain(b.textContent) === label) as
      | HTMLButtonElement
      | undefined;
  const timeline = () => [...page.querySelectorAll('.timeline li')].map((step) => plain(step.textContent));

  it('shows an issued invoice as a document with its timeline and amounts', async () => {
    await open(testIssuedInvoice({ dueDate: addDays(today, -3), overdue: true }));

    expect(page.querySelector('h1')?.textContent).toBe('F-2026-0001');
    expect(plain(page.querySelector('.head .status-badge')?.textContent)).toBe('Overdue');
    expect(page.querySelector('app-invoice-document .number')?.textContent).toBe('F-2026-0001');
    expect(timeline()[0]).toContain('Draft created');
    expect(timeline()[1]).toContain('Issued as F-2026-0001');
    expect(timeline()[2]).toContain('3 days late');
    expect(page.querySelector('.timeline li:last-child')?.className).toBe('danger');
    expect(plain(page.querySelector('.amounts .grand')?.textContent)).toContain('1 560,00 €');
    expect(button('Download PDF')?.disabled).toBe(true);
    expect(button('Edit draft')).toBeUndefined();
    expect(page.querySelector('.actions .note')?.textContent).toContain('frozen by law');
  });

  it('cancels an issued invoice after a warning', async () => {
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    await open(testIssuedInvoice());

    button('Cancel invoice')!.click();
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cancel invoice F-2026-0001?', tone: 'danger' }));
    const request = http.expectOne(`${INVOICES_API}/1/cancel`);
    expect(request.request.method).toBe('POST');
    request.flush(testIssuedInvoice({ status: 'CANCELLED', cancelledAt: '2026-10-24T09:00:00Z' }));
    await fixture.whenStable();

    expect(success).toHaveBeenCalledWith('Invoice F-2026-0001 cancelled.');
    expect(plain(page.querySelector('.head .status-badge')?.textContent)).toBe('Cancelled');
    expect(timeline().at(-1)).toContain('Cancelled');
    expect(button('Cancel invoice')).toBeUndefined();
  });

  it('duplicates an invoice into a new draft and opens it', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await open(testIssuedInvoice());

    button('Duplicate')!.click();
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1/duplicate`).flush(testInvoice({ id: 2 }));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/invoices', 2, 'edit']);
  });

  it('issues a complete draft from its page', async () => {
    await open(testInvoice());
    expect(page.querySelector('h1')?.textContent).toBe('Draft invoice');
    expect(button('Edit draft')?.getAttribute('href')).toBe('/invoices/1/edit');
    expect(timeline()[1]).toContain('Not issued yet');

    button('Issue invoice')!.click();
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1/issue`).flush(testIssuedInvoice());
    await fixture.whenStable();

    expect(page.querySelector('h1')?.textContent).toBe('F-2026-0001');
  });

  it('says what an incomplete draft needs before it can be issued', async () => {
    await open(
      testInvoice({
        checks: [
          { code: 'CUSTOMER', required: true, passed: true },
          { code: 'CUSTOMER_ADDRESS', required: true, passed: false },
          { code: 'LINES', required: true, passed: true },
          { code: 'CUSTOMER_SIREN', required: false, passed: false },
        ],
      }),
    );

    expect(button('Issue invoice')?.disabled).toBe(true);
    expect(page.querySelector('.note.warn')?.textContent).toContain('To issue it, complete: customer billing address.');
  });

  it('deletes a draft and goes back to the list', async () => {
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await open(testInvoice());

    button('Delete draft')!.click();
    await fixture.whenStable();
    const request = http.expectOne(`${INVOICES_API}/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/invoices');
  });

  it('shows the error of a refused action', async () => {
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    await open(testIssuedInvoice());

    button('Cancel invoice')!.click();
    await fixture.whenStable();
    http
      .expectOne(`${INVOICES_API}/1/cancel`)
      .flush({ detail: 'Invoice F-2026-0001 is already cancelled' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(error).toHaveBeenCalledWith('Invoice F-2026-0001 is already cancelled');
  });

  it('says when the invoice does not exist', async () => {
    await fixture.whenStable();
    http.expectOne(`${INVOICES_API}/1`).flush({ detail: 'not found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('This invoice does not exist or has been deleted.');
  });
});
