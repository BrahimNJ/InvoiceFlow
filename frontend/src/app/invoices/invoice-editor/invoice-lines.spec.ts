import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { invoiceForm, lineForm } from './invoice-form';
import { InvoiceLines } from './invoice-lines';

@Component({
  imports: [InvoiceLines],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-invoice-lines [lines]="form.controls.lines" [franchise]="franchise()" />`,
})
class Host {
  readonly form = invoiceForm();
  readonly franchise = signal(false);
}

/** Intl uses narrow no-break spaces in French amounts. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ').trim();

describe('InvoiceLines', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    page = fixture.nativeElement as HTMLElement;
    host.form.controls.lines.push(lineForm({ label: 'Design', quantity: '1,5', unitPrice: '400' }));
    host.form.controls.lines.push(lineForm({ label: 'Hosting', quantity: '12', unitPrice: '9,99', vatRate: 20 }));
    await fixture.whenStable();
  });

  const labels = () => host.form.controls.lines.controls.map((line) => line.controls.label.value);
  const button = (label: string) => page.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    // afterNextRender moves the focus after the next render
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('shows each line with its live total', () => {
    const totals = [...page.querySelectorAll('.total')].map((cell) => plain(cell.textContent));

    expect(totals).toEqual(['600,00 €', '119,88 €']);
  });

  describe('under the VAT franchise', () => {
    beforeEach(async () => {
      host.franchise.set(true);
      await fixture.whenStable();
    });

    const rates = () => host.form.controls.lines.controls.map((line) => line.controls.vatRate.value);

    it('explains the franchise and bills new lines at 0 %', async () => {
      expect(page.querySelector('.franchise-note')?.textContent).toContain('art. 293 B du CGI');

      page.querySelector<HTMLButtonElement>('.add button')!.click();
      await settle();

      expect(rates()).toEqual([20, 20, 0]);
    });

    it('sets every line back to 0 % in one click, then hides the button', async () => {
      page.querySelector<HTMLButtonElement>('.franchise-note button')!.click();
      await settle();

      expect(rates()).toEqual([0, 0]);
      expect(host.form.controls.lines.dirty).toBe(true);
      expect(page.querySelector('.franchise-note button')).toBeNull();
    });
  });

  it('does not mention the franchise otherwise, and keeps the catalogue rate of new lines', async () => {
    expect(page.querySelector('.franchise-note')).toBeNull();

    page.querySelector<HTMLButtonElement>('.add button')!.click();
    await settle();

    expect(host.form.controls.lines.controls.at(-1)!.controls.vatRate.value).toBe(20);
  });

  it('adds a free line with Enter on the last line and focuses it', async () => {
    const lastPrice = page.querySelectorAll<HTMLInputElement>('input[formcontrolname="unitPrice"]')[1];
    lastPrice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();

    expect(labels()).toEqual(['Design', 'Hosting', '']);
    expect(document.activeElement).toBe(page.querySelectorAll('input[formcontrolname="label"]')[2]);
    expect(host.form.controls.lines.dirty).toBe(true);
  });

  it('moves to the next line with Enter on another line', async () => {
    page.querySelector('input[formcontrolname="label"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();

    expect(labels()).toEqual(['Design', 'Hosting']);
    expect(document.activeElement).toBe(page.querySelectorAll('input[formcontrolname="label"]')[1]);
  });

  it('duplicates, reorders and removes lines', async () => {
    button('Duplicate line 1').click();
    await settle();
    expect(labels()).toEqual(['Design', 'Design', 'Hosting']);

    button('Move line 3 up').click();
    await settle();
    expect(labels()).toEqual(['Design', 'Hosting', 'Design']);
    expect(button('Move line 1 up').disabled).toBe(true);
    expect(button('Move line 3 down').disabled).toBe(true);

    button('Remove line 1').click();
    await settle();
    expect(labels()).toEqual(['Hosting', 'Design']);
  });

  it('opens the details field of a line on demand', async () => {
    expect(page.querySelector('textarea')).toBeNull();

    button('Add details of line 1').click();
    await settle();

    expect(document.activeElement).toBe(page.querySelector('textarea'));
  });

  it('explains how to start when there is no line', async () => {
    const empty = TestBed.createComponent(Host);
    await empty.whenStable();

    expect((empty.nativeElement as HTMLElement).querySelector('.empty')?.textContent).toContain('No line yet');
  });
});
