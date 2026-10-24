import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/problem-detail';
import { AppHeader } from '../../shared/app-header';
import { formatEuros, formatPercent } from '../../shared/format/money';
import { Icon, IconName } from '../../shared/icon/icon';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ToastService } from '../../shared/ui/toast.service';
import { dueDate, dueLabel, formatDate, todayIso } from '../invoice-calc';
import { InvoiceDocumentView, documentFromInvoice } from '../invoice-document/invoice-document';
import { Invoice, READINESS, statusBadge } from '../invoice.models';
import { InvoiceService } from '../invoice.service';

type Action = 'issue' | 'cancel' | 'duplicate' | 'delete';

interface TimelineStep {
  label: string;
  icon: IconName;
  /** ISO date or instant; the step is upcoming when absent. */
  when: string | null;
  detail?: string;
  tone?: 'danger' | 'done';
}

/**
 * One invoice (`/invoices/:id`): the A4 document as the customer receives it, and beside it the status timeline,
 * the amounts, the customer and what can still be done with it.
 */
@Component({
  selector: 'app-invoice-detail',
  imports: [AppHeader, DatePipe, Icon, InvoiceDocumentView, RouterLink],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetail implements OnInit {
  private readonly invoices = inject(InvoiceService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly user = inject(AuthService).user;

  /** From the `:id` route parameter (router input binding). */
  readonly id = input.required<string>();

  protected readonly formatEuros = formatEuros;
  protected readonly formatPercent = formatPercent;
  protected readonly formatDate = formatDate;
  protected readonly today = todayIso();

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  /** The action in progress; one at a time. */
  protected readonly busy = signal<Action | null>(null);

  protected readonly badge = computed(() => {
    const invoice = this.invoice();
    return invoice ? statusBadge(invoice.status, invoice.overdue) : null;
  });
  protected readonly doc = computed(() => {
    const invoice = this.invoice()!;
    const seller = [this.user()?.firstName, this.user()?.lastName].filter(Boolean).join(' ') || 'Your company';
    return documentFromInvoice(invoice, seller, this.today, dueDate(invoice.paymentTerms, this.today));
  });
  protected readonly blocking = computed(
    () => this.invoice()?.checks.filter((check) => check.required && !check.passed) ?? [],
  );
  protected readonly blockingText = computed(() =>
    this.blocking()
      .map((check) => READINESS[check.code].label.toLowerCase())
      .join(', '),
  );
  protected readonly timeline = computed((): TimelineStep[] => {
    const invoice = this.invoice();
    if (!invoice) {
      return [];
    }
    const steps: TimelineStep[] = [{ label: 'Draft created', icon: 'pencil', when: invoice.createdAt, tone: 'done' }];
    steps.push({
      label: invoice.issuedAt ? `Issued as ${invoice.number}` : 'Not issued yet',
      icon: 'send',
      when: invoice.issuedAt,
      tone: invoice.issuedAt ? 'done' : undefined,
    });
    if (invoice.status === 'CANCELLED') {
      steps.push({ label: 'Cancelled', icon: 'x', when: invoice.cancelledAt, tone: 'danger' });
    } else if (invoice.dueDate) {
      const due = dueLabel(invoice.dueDate, this.today);
      steps.push({
        label: `Due on ${formatDate(invoice.dueDate)}`,
        icon: due.late ? 'alert' : 'calendar',
        when: null,
        detail: due.text,
        tone: due.late ? 'danger' : undefined,
      });
    }
    return steps;
  });

  ngOnInit(): void {
    this.invoices
      .get(Number(this.id()))
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (invoice) => this.invoice.set(invoice),
        error: (error: unknown) =>
          this.loadError.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'This invoice does not exist or has been deleted.'
              : errorMessage(error),
          ),
      });
  }

  /** Hours are shown for the record (issued at 10:05), dates for the rest. */
  protected isInstant(when: string): boolean {
    return when.includes('T');
  }

  protected async issue(): Promise<void> {
    const invoice = this.invoice()!;
    const ok = await this.confirm.ask({
      title: 'Issue this invoice?',
      message:
        `It gets the next invoice number and is dated today, ${formatDate(this.today)}. ` +
        'An issued invoice can no longer be changed or deleted, only cancelled.',
      confirmLabel: 'Issue invoice',
    });
    if (ok) {
      this.run('issue', this.invoices.issue(invoice.id), (issued) => {
        this.invoice.set(issued);
        this.toasts.success(`Invoice ${issued.number} issued.`);
      });
    }
  }

  protected async cancel(): Promise<void> {
    const invoice = this.invoice()!;
    const ok = await this.confirm.ask({
      title: `Cancel invoice ${invoice.number}?`,
      message:
        'It stays in your records with its number, marked as cancelled. To bill again, duplicate it and issue the copy.',
      confirmLabel: 'Cancel invoice',
      tone: 'danger',
    });
    if (ok) {
      this.run('cancel', this.invoices.cancel(invoice.id), (cancelled) => {
        this.invoice.set(cancelled);
        this.toasts.success(`Invoice ${cancelled.number} cancelled.`);
      });
    }
  }

  protected duplicate(): void {
    this.run('duplicate', this.invoices.duplicate(this.invoice()!.id), (copy) => {
      this.toasts.success('A new draft was created from this invoice.');
      void this.router.navigate(['/invoices', copy.id, 'edit']);
    });
  }

  protected async delete(): Promise<void> {
    const invoice = this.invoice()!;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: 'It was never issued, so no number is lost. This cannot be undone.',
      confirmLabel: 'Delete draft',
      tone: 'danger',
    });
    if (ok) {
      this.run('delete', this.invoices.delete(invoice.id), () => {
        this.toasts.success('Draft deleted.');
        void this.router.navigateByUrl('/invoices');
      });
    }
  }

  private run<T>(action: Action, request: Observable<T>, done: (result: T) => void): void {
    if (this.busy() !== null) {
      return;
    }
    this.busy.set(action);
    request
      .pipe(
        finalize(() => this.busy.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: done, error: (error: unknown) => this.toasts.error(errorMessage(error)) });
  }
}
