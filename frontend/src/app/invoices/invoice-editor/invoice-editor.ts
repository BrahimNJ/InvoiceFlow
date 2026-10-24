import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, finalize, map, startWith } from 'rxjs';

import { errorMessage } from '../../core/http/problem-detail';
import { Customer } from '../../customers/customer.models';
import { CustomerService } from '../../customers/customer.service';
import { AppHeader } from '../../shared/app-header';
import { formatEuros, formatPercent } from '../../shared/format/money';
import { showError } from '../../shared/forms/forms';
import { Icon } from '../../shared/icon/icon';
import { Autocomplete } from '../../shared/ui/autocomplete';
import { ToastService } from '../../shared/ui/toast.service';
import { computeTotals, dueDate, formatDate, todayIso } from '../invoice-calc';
import { BilledCustomer, Invoice, PAYMENT_TERMS, PaymentTerms } from '../invoice.models';
import { InvoiceService } from '../invoice.service';
import {
  NOTES_MAX_LENGTH,
  applyInvoiceServerErrors,
  invoiceForm,
  loadInvoice,
  pricedLine,
  toPayload,
} from './invoice-form';
import { InvoiceLines } from './invoice-lines';

/** The customer billed by the draft: its id and the details printed on the invoice. */
export interface SelectedCustomer {
  id: number | null;
  details: BilledCustomer;
}

export function billedCustomer(customer: Customer): BilledCustomer {
  return {
    name: customer.name,
    email: customer.email,
    street: customer.street,
    postalCode: customer.postalCode,
    city: customer.city,
    country: customer.country,
    siret: customer.siret,
    vatNumber: customer.vatNumber,
  };
}

/**
 * Writes a draft invoice (`/invoices/new`, `/invoices/:id/edit`) in one workspace: customer, payment terms, lines and
 * notes on the left, live totals on the right. Saving keeps it a draft; nothing is numbered before it is issued.
 */
@Component({
  selector: 'app-invoice-editor',
  imports: [AppHeader, Autocomplete, Icon, InvoiceLines, ReactiveFormsModule, RouterLink],
  templateUrl: './invoice-editor.html',
  styleUrl: './invoice-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceEditor implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly customers = inject(CustomerService);
  private readonly toasts = inject(ToastService);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  /** From the `:id` route parameter (router input binding); absent for a new draft. */
  readonly id = input<string>();

  private readonly customerPicker = viewChild<Autocomplete<Customer>>('customerPicker');

  protected readonly termOptions = (Object.keys(PAYMENT_TERMS) as PaymentTerms[]).map((terms) => ({
    terms,
    ...PAYMENT_TERMS[terms],
  }));
  protected readonly notesMax = NOTES_MAX_LENGTH;
  protected readonly formatEuros = formatEuros;
  protected readonly formatPercent = formatPercent;
  protected readonly formatDate = formatDate;
  protected readonly showError = showError;
  protected readonly today = todayIso();

  protected readonly form = invoiceForm();
  protected readonly value = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    requireSync: true,
  });

  protected readonly customer = signal<SelectedCustomer | null>(null);
  /** The saved draft (after the first save, or when editing). */
  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Changes since the last save (form or customer). */
  protected readonly dirty = signal(false);

  protected readonly totals = computed(() => computeTotals(this.value().lines.map(pricedLine)));
  protected readonly dueIfIssuedToday = computed(() => dueDate(this.value().paymentTerms, this.today));
  protected readonly address = computed(() => {
    const details = this.customer()?.details;
    if (!details) {
      return [];
    }
    return [details.street, [details.postalCode, details.city].filter(Boolean).join(' '), details.country].filter(
      (part): part is string => !!part,
    );
  });

  protected readonly searchCustomers = (text: string): Observable<Customer[]> =>
    this.customers.list({ search: text, size: 8 }).pipe(map((page) => page.content));

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.dirty) {
        this.dirty.set(true);
      }
    });
  }

  ngOnInit(): void {
    const id = this.id();
    if (id !== undefined) {
      this.load(Number(id));
    }
  }

  /** True when leaving the page would lose changes (used by the route guard). */
  hasUnsavedChanges(): boolean {
    return this.dirty() && !this.saving();
  }

  protected pickCustomer(customer: Customer): void {
    this.customer.set({ id: customer.id, details: billedCustomer(customer) });
    this.dirty.set(true);
  }

  protected changeCustomer(): void {
    this.customer.set(null);
    this.dirty.set(true);
    setTimeout(() => this.customerPicker()?.focus());
  }

  protected notesLength(): number {
    return this.value().notes.length;
  }

  protected save(): void {
    this.persist().subscribe({
      next: (invoice) => this.toasts.success(invoice.customer.name ? `Draft for ${invoice.customer.name} saved.` : 'Draft saved.'),
      error: () => undefined,
    });
  }

  /**
   * Creates or updates the draft. Emits the saved invoice; on a rejected save, shows the errors and errors out.
   * A new draft moves to its edit URL, so that the next save updates it.
   */
  protected persist(): Observable<Invoice> {
    return new Observable<Invoice>((subscriber) => {
      if (this.saving()) {
        subscriber.complete();
        return;
      }
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.error.set('Some lines need your attention.');
        this.focusFirstInvalid();
        subscriber.error(new Error('invalid'));
        return;
      }
      const payload = toPayload(this.form, this.customer()?.id ?? null);
      const saved = this.invoice();
      this.saving.set(true);
      this.error.set(null);
      const subscription = (saved ? this.invoices.update(saved.id, payload) : this.invoices.create(payload))
        .pipe(
          finalize(() => this.saving.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (invoice) => {
            this.invoice.set(invoice);
            this.form.markAsPristine();
            this.dirty.set(false);
            if (!saved) {
              // Same screen, now for a saved draft: the URL changes without reloading the editor
              this.location.replaceState(`/invoices/${invoice.id}/edit`);
            }
            subscriber.next(invoice);
            subscriber.complete();
          },
          error: (error: unknown) => {
            this.error.set(errorMessage(error));
            applyInvoiceServerErrors(this.form, error);
            this.focusFirstInvalid();
            subscriber.error(error);
          },
        });
      return () => subscription.unsubscribe();
    });
  }

  private focusFirstInvalid(): void {
    setTimeout(() => this.host.querySelector<HTMLElement>('.ng-invalid:not(form, fieldset, [formarrayname], .line)')?.focus());
  }

  private load(id: number): void {
    this.loading.set(true);
    this.invoices
      .get(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (invoice) => {
          if (invoice.status !== 'DRAFT') {
            this.loadError.set(`Invoice ${invoice.number} is issued: it can no longer be changed.`);
            this.invoice.set(invoice);
            return;
          }
          this.invoice.set(invoice);
          loadInvoice(this.form, invoice);
          this.customer.set(invoice.customer.name ? { id: invoice.customerId, details: invoice.customer } : null);
          this.form.markAsPristine();
          this.dirty.set(false);
        },
        error: (error: unknown) =>
          this.loadError.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'This invoice does not exist or has been deleted.'
              : errorMessage(error),
          ),
      });
  }
}
