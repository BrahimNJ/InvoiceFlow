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
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, finalize, map, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ProblemDetail, errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { formatEuros, formatPercent } from '../../shared/format/money';
import { showError } from '../../shared/forms/forms';
import { Icon } from '../../shared/icon/icon';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { computeTotals, dueDate, formatDate, lineTotal, operationNature, readiness, todayIso } from '../invoice-calc';
import { InvoiceDocument, InvoiceDocumentView } from '../invoice-document/invoice-document';
import { Invoice, PAYMENT_TERMS, PaymentTerms, READINESS, ReadinessCode } from '../invoice.models';
import { InvoiceService } from '../invoice.service';
import {
  NOTES_MAX_LENGTH,
  applyInvoiceServerErrors,
  invoiceForm,
  loadInvoice,
  pricedLine,
  toPayload,
} from './invoice-form';
import { InvoiceCustomer, SelectedCustomer } from './invoice-customer';
import { InvoiceLines } from './invoice-lines';
import { InvoiceSidePanel } from './invoice-side-panel';

/**
 * Writes a draft invoice (`/invoices/new`, `/invoices/:id/edit`) in one workspace: customer, payment terms, lines and
 * notes on the left, live totals on the right. Saving keeps it a draft; nothing is numbered before it is issued.
 */
@Component({
  selector: 'app-invoice-editor',
  imports: [
    AppHeader,
    Icon,
    InvoiceCustomer,
    InvoiceDocumentView,
    InvoiceLines,
    InvoiceSidePanel,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './invoice-editor.html',
  styleUrl: './invoice-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceEditor implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly user = inject(AuthService).user;
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  /** From the `:id` route parameter (router input binding); absent for a new draft. */
  readonly id = input<string>();

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
  protected readonly issuing = signal(false);
  /** Phones and tablets: the A4 preview opens full screen. */
  protected readonly previewOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Changes since the last save (form or customer). */
  protected readonly dirty = signal(false);

  protected readonly totals = computed(() => computeTotals(this.value().lines.map(pricedLine)));
  protected readonly dueIfIssuedToday = computed(() => dueDate(this.value().paymentTerms, this.today));
  protected readonly checks = computed(() => readiness(this.customer()?.details ?? null, this.value().lines.length));
  protected readonly blocking = computed(() => this.checks().filter((check) => check.required && !check.passed));
  /** The invoice as it would be printed if issued today. */
  protected readonly doc = computed(
    (): InvoiceDocument => ({
      number: null,
      cancelled: false,
      issueDate: this.today,
      dueDate: this.dueIfIssuedToday(),
      paymentTerms: this.value().paymentTerms,
      seller: [this.user()?.firstName, this.user()?.lastName].filter(Boolean).join(' ') || 'Your company',
      customer: this.customer()?.details ?? null,
      lines: this.value().lines.map((line) => {
        const priced = pricedLine(line);
        return {
          label: line.label,
          details: line.details || null,
          quantity: priced.quantity,
          unit: line.unit,
          unitPrice: priced.unitPrice,
          vatRate: priced.vatRate,
          lineTotal: lineTotal(priced.quantity, priced.unitPrice),
        };
      }),
      totals: this.totals(),
      operationNature: operationNature(this.value().lines.map((line) => line.type)),
      notes: this.value().notes.trim() || null,
    }),
  );
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

  protected customerChanged(): void {
    this.dirty.set(true);
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
   * Saves the draft, then issues it once the user confirms: it gets its number and can no longer be changed.
   * Opens the issued invoice.
   */
  protected async issue(): Promise<void> {
    if (this.issuing() || this.saving() || this.blocking().length > 0) {
      return;
    }
    const confirmed = await this.confirm.ask({
      title: 'Issue this invoice?',
      message:
        `It gets the next invoice number and is dated today, ${formatDate(this.today)}. ` +
        'An issued invoice can no longer be changed or deleted, only cancelled.',
      confirmLabel: 'Issue invoice',
    });
    if (!confirmed) {
      return;
    }
    this.issuing.set(true);
    this.persist()
      .pipe(
        switchMap((draft) => this.invoices.issue(draft.id)),
        finalize(() => this.issuing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (invoice) => {
          this.toasts.success(`Invoice ${invoice.number} issued.`);
          void this.router.navigate(['/invoices', invoice.id]);
        },
        error: (error: unknown) => {
          // A form that is not valid already shows its errors
          if (!(error instanceof InvalidForm)) {
            this.error.set(issueErrorMessage(error));
          }
        },
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
        subscriber.error(new InvalidForm());
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

/** The draft was not sent: some fields are not valid. */
class InvalidForm extends Error {}

/** The missing mentions of a 422, in words; the generic message otherwise. */
function issueErrorMessage(error: unknown): string {
  const missing =
    error instanceof HttpErrorResponse && error.status === 422
      ? ((error.error as ProblemDetail & { missing?: ReadinessCode[] }).missing ?? [])
      : [];
  return missing.length > 0
    ? `This invoice cannot be issued yet. Missing: ${missing.map((code) => READINESS[code].label.toLowerCase()).join(', ')}.`
    : errorMessage(error);
}
